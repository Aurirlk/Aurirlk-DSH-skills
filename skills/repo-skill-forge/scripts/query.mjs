#!/usr/bin/env node
// 索引查询 CLI —— 6 个查询技能背后真正干活的那一个。
//
// 一条设计原则：**答案必须带置信度和出处**。说"这三处调用了它"要能指到 file:line；
// 名字级匹配的结论必须标 medium，不能和"语法确定的 import 边"混在一起说。
//
// 用法：
//   node query.mjs <命令> [参数] [--index <目录>] [--json]
// 命令：
//   where <名字>              定义在哪
//   refs <名字>               谁引用了这个名字
//   callers <名字>            谁调用了它（含置信度）
//   callees <名字>            它调用了谁
//   impact <文件|符号> [--depth 2]   改它会波及什么
//   route <路径片段>          端点 → 处理器 → 下游
//   mods                      模块与跨模块依赖
//   deps <文件>               它导入了什么 / 谁导入了它
//   stats                     索引概况与热点
//   files <片段>              按路径找文件
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { braceDelta, collectRefs } from './lib/extract.mjs'

// ------------------------------------------------------------------ 参数

const argv = process.argv.slice(2)
const opts = { index: null, json: false, depth: 2, limit: 40, facts: null }
const words = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--index') opts.index = argv[++i]
  else if (a === '--facts') opts.facts = argv[++i]
  else if (a === '--json') opts.json = true
  else if (a === '--depth') opts.depth = parseInt(argv[++i], 10) || 2
  else if (a === '--limit') opts.limit = parseInt(argv[++i], 10) || 40
  else if (a === '-h' || a === '--help') { usage(); process.exit(0) }
  else words.push(a)
}
const [cmd, ...rest] = words

function usage() {
  console.log(`用法：node query.mjs <命令> [参数] [--index 目录] [--json]

  where <名字>            定义在哪（类/方法/函数/接口）
  refs <名字>             谁引用了这个���字（按引用次数排序）
  callers <名字>          谁调用了它（high=导入了定义文件，medium=仅名字匹配）
  callees <名字>          它调用了谁
  impact <文件|符号>      改它会波及什么（--depth 默认 2）
  route <路径片段>        端点 → 处理器 → 下游
  mods                    模块与跨模块依赖
  deps <文件>             导入 / 被导入
  stats                   索引概况与热点
  files <片段>            按路径找文件

索引位置：--index，或环境变量 REPO_INDEX，或从当前目录向上找 repo-index/index.json。`)
}

// ------------------------------------------------------------------ 载入索引

function findIndexDir() {
  if (opts.index) return resolve(opts.index)
  if (process.env.REPO_INDEX) return resolve(process.env.REPO_INDEX)
  // 自带索引：查询器被复制到 <包>/repo-index/bin/ 时，默认就用上一级
  try {
    const selfDir = dirname(fileURLToPath(import.meta.url))
    const sibling = resolve(selfDir, '..')
    if (existsSync(join(sibling, 'index.json'))) return sibling
  } catch { /* 单文件运行时没有 import.meta.url，忽略 */ }
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    for (const cand of ['repo-index', 'index', '.repo-index']) {
      const p = join(dir, cand, 'index.json')
      if (existsSync(p)) return join(dir, cand)
    }
    const direct = join(dir, 'index.json')
    if (existsSync(direct)) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

const indexDir = findIndexDir()
if (!indexDir || !existsSync(join(indexDir, 'index.json'))) {
  console.error('没找到索引。先跑：node build-index.mjs <仓库> --out <目录>，再用 --index 指过去。')
  process.exit(2)
}
const index = JSON.parse(readFileSync(join(indexDir, 'index.json'), 'utf8'))
let facts = null
const factsPath = opts.facts ? resolve(opts.facts) : join(indexDir, 'facts.json')
if (existsSync(factsPath)) {
  try { facts = JSON.parse(readFileSync(factsPath, 'utf8')) } catch { facts = null }
}

const ROOT = index.meta.root
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k)
const lineCache = new Map()
function sourceLines(rel) {
  if (lineCache.has(rel)) return lineCache.get(rel)
  let lines = []
  try { lines = readFileSync(join(ROOT, rel), 'utf8').split(/\r?\n/) } catch { lines = [] }
  lineCache.set(rel, lines)
  return lines
}
const src = (rel, line) => (sourceLines(rel)[line - 1] || '').trim().slice(0, 160)

// 反向导入表：谁导入了我
const importers = new Map()
for (const [rel, e] of Object.entries(index.files)) {
  for (const imp of e.imports) {
    if (!imp.resolved) continue
    const list = importers.get(imp.resolved) || []
    list.push(rel)
    importers.set(imp.resolved, list)
  }
}

function findSymbols(name) {
  if (!name) return []
  if (name.includes('#')) {
    const [container, member] = name.split('#')
    return index.symbols.filter((s) => s.name === member && s.container === container)
  }
  const exact = has(index.byName, name) ? index.byName[name] : []
  if (exact.length) return exact.map((id) => index.symbols.find((s) => s.id === id)).filter(Boolean)
  // 退化：包含匹配（大小写不敏感），最多 20 条，避免"查个 a 出来一半代码库"
  const lower = name.toLowerCase()
  return index.symbols.filter((s) => s.name.toLowerCase().includes(lower)).slice(0, 20)
}

/** 符号体：从定义行往下数到括号配平。抽不出体就返回空串（比如接口里的声明）。 */
function symbolBody(sym) {
  const lines = sourceLines(sym.file)
  if (!lines.length) return ''
  let text = ''
  let depth = 0
  let started = false
  for (let i = sym.line - 1; i < Math.min(lines.length, sym.line + 400); i++) {
    const line = lines[i]
    text += line + '\n'
    const d = braceDelta(line)
    if (d > 0) started = true
    depth += d
    if (started && depth <= 0) break
    if (!started && /;\s*$/.test(line)) break
  }
  return text
}

function refsOfFile(rel, name) {
  const lines = sourceLines(rel)
  const re = new RegExp(`\\b${escapeRe(name)}\\b`, 'g')
  const hits = []
  for (let i = 0; i < lines.length && hits.length < 6; i++) {
    if (re.test(lines[i])) { hits.push({ line: i + 1, text: lines[i].trim().slice(0, 140) }); re.lastIndex = 0 }
  }
  return hits
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function filesReferencing(name, excludeFiles = new Set()) {
  const out = []
  for (const [rel, e] of Object.entries(index.files)) {
    if (excludeFiles.has(rel)) continue
    if (!has(e.refs, name)) continue
    out.push({ file: rel, count: e.refs[name], module: e.module })
  }
  return out.sort((a, b) => b.count - a.count)
}

// ------------------------------------------------------------------ 命令实现

function cmdWhere(name) {
  const syms = findSymbols(name)
  if (!syms.length) return { ok: false, message: `没有找到 "${name}"。可能是拼写、或者是动态生成的符号。` }
  return {
    ok: true,
    query: name,
    results: syms.map((s) => ({ ...s, snippet: src(s.file, s.line) })),
  }
}

function cmdRefs(name) {
  const defs = findSymbols(name)
  const defFiles = new Set(defs.map((s) => s.file))
  const refs = filesReferencing(name, defFiles)
  return { ok: refs.length > 0, query: name, definitions: defs.map((s) => ({ file: s.file, line: s.line, kind: s.kind, container: s.container })), references: refs.map((r) => ({ ...r, hits: refsOfFile(r.file, name) })) }
}

function cmdCallers(name) {
  const defs = findSymbols(name)
  if (!defs.length) return { ok: false, message: `没有找到 "${name}"。` }
  const defFiles = new Set(defs.map((s) => s.file))
  const out = []
  for (const r of filesReferencing(name, defFiles)) {
    const importsDef = index.files[r.file]?.imports?.some((i) => i.resolved && defFiles.has(i.resolved))
    out.push({ ...r, confidence: importsDef ? 'high' : 'medium', reason: importsDef ? '导入了定义文件' : '仅名字匹配（可能同名符号）' })
  }
  return { ok: out.length > 0, query: name, definitions: defs.map((s) => ({ file: s.file, line: s.line, container: s.container })), callers: out }
}

function cmdCallees(name) {
  const syms = findSymbols(name)
  if (!syms.length) return { ok: false, message: `没有找到 "${name}"。` }
  const s = syms.find((x) => x.kind === 'method' || x.kind === 'function' || x.kind === 'constructor') || syms[0]
  const body = symbolBody(s)
  if (!body) return { ok: false, message: `"${s.name}" 没有可读的函数体（可能是接口声明或抽象方法）。` }
  // 用统一的 collectRefs：它已经剔掉了 if/for/new 这类关键字，
  // 否则"未定义下游"里会排满 `if ×2` 这种噪音。
  const counts = collectRefs(body)
  const known = []
  const unknown = []
  for (const [n, c] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (n === s.name) continue
    const def = has(index.byName, n) ? index.byName[n] : null
    if (def) {
      // 同名多定义时把数量说出来：只报第一个会让人以为"就这一个"
      known.push({
        name: n, calls: c, definitions: def.slice(0, 3).map((id) => { const x = index.symbols.find((y) => y.id === id); return x ? `${x.file}:${x.line}` : id }),
        ambiguous: def.length > 1 ? def.length : 0,
      })
    } else if (c > 1) unknown.push({ name: n, calls: c })
  }
  return { ok: true, symbol: { name: s.name, file: s.file, line: s.line, container: s.container }, resolved: known.slice(0, 40), unresolved: unknown.slice(0, 15) }
}

function cmdImpact(target) {
  if (!target) return { ok: false, message: '要给一个文件路径或符号名。' }
  // 目标可以是文件，也可以是符号
  let seedFiles = []
  let seedSymbols = []
  if (index.files[target]) seedFiles = [target]
  else {
    const norm = target.replace(/\\/g, '/')
    const hit = Object.keys(index.files).find((f) => f === norm || f.endsWith('/' + norm))
    if (hit) seedFiles = [hit]
    else {
      seedSymbols = findSymbols(target)
      seedFiles = [...new Set(seedSymbols.map((s) => s.file))]
    }
  }
  if (!seedFiles.length) return { ok: false, message: `没有找到 "${target}"（既不是索引里的文件，也不是已知符号）。` }

  const byDepth = []
  const visited = new Set(seedFiles)
  let frontier = [...seedFiles]
  for (let d = 1; d <= opts.depth; d++) {
    const high = []
    const medium = []
    for (const f of frontier) {
      for (const importer of importers.get(f) || []) {
        if (visited.has(importer)) continue
        visited.add(importer)
        high.push({ file: importer, via: f, confidence: 'high' })
      }
      // 名字级兜底：只认"对外可见 + 有辨识度"的符号。
      // 不加这两道过滤，`stop` / `close` 这种常见方法名会把半个仓库拉进来，
      // 影响面看起来很大其实全是误判——比没有结论更坏。
      const e = index.files[f]
      const names = (e?.symbols || [])
        .map((id) => index.symbols.find((s) => s.id === id))
        .filter((s) => s && s.exported && s.name.length >= 4)
        .filter((s) => (index.byName[s.name] || []).length <= 5)
        .map((s) => s.name)
      if (names.length) {
        for (const [rel, other] of Object.entries(index.files)) {
          if (visited.has(rel)) continue
          const hit = names.find((n) => has(other.refs, n))
          if (hit) { visited.add(rel); medium.push({ file: rel, via: `${f} 的符号 ${hit}`, confidence: 'medium' }); if (medium.length >= 40) break }
        }
      }
    }
    frontier = [...high, ...medium].map((x) => x.file)
    byDepth.push({ depth: d, high, medium, files: frontier.length })
    if (!frontier.length) break
  }

  const affectedFiles = [...visited].filter((f) => !seedFiles.includes(f))
  const modules = [...new Set(affectedFiles.map((f) => index.files[f]?.module).filter(Boolean))]
  const affectedSymbols = index.symbols.filter((s) => affectedFiles.includes(s.file)).length

  return {
    ok: true,
    target: { files: seedFiles, symbols: seedSymbols.map((s) => `${s.file}#${s.name}`) },
    depth: opts.depth,
    byDepth,
    summary: { files: affectedFiles.length, modules, symbols: affectedSymbols },
    caveat: [
      'high = 有 import 边；medium = 只匹配到名字，可能是同名误判。',
      'Java 同包类不写 import，所以同包引用只会出现在 medium 里——这不是漏，是语言特性。',
      '动态导入、反射、Spring 的字符串 bean 名、模板/配置里写死的类名，索引看不见。',
    ],
  }
}

function cmdRoute(pattern) {
  if (!facts) return { ok: false, message: `这个索引旁边没有 facts.json（${factsPath}），端点信息在扫描结果里。先跑 scan-repo.mjs 并把 facts.json 放进索引目录。` }
  const needle = (pattern || '').toLowerCase()
  const eps = (facts.httpEndpoints || []).filter((e) => e.scope === 'production' && (!needle || e.path.toLowerCase().includes(needle)))
  if (!eps.length) return { ok: false, message: `没有匹配 "${pattern}" 的端点。` }

  const traced = eps.slice(0, 12).map((e) => {
    const [cls, meth] = (e.handler || '').split('#')
    const handler = index.symbols.find((s) => s.name === meth && s.container === cls) || (has(index.byName, meth) ? index.byName[meth] : []).map((id) => index.symbols.find((s) => s.id === id)).find(Boolean)
    let downstream = []
    if (handler) {
      const body = symbolBody(handler)
      const calls = new Set()
      const re = /([A-Za-z_$][\w$]*)\s*\(/g
      let m
      while ((m = re.exec(body))) calls.add(m[1])
      downstream = [...calls].filter((n) => has(index.byName, n)).slice(0, 10).map((n) => {
        const s = index.symbols.find((x) => x.id === index.byName[n][0])
        return { name: n, file: s.file, line: s.line, container: s.container }
      })
    }
    // 表名猜测：从 handler 所在文件往下游文件里找 @TableName / @Entity 的类
    const entities = []
    for (const d of downstream) {
      const e2 = index.files[d.file]
      for (const id of e2?.symbols || []) {
        const s = index.symbols.find((x) => x.id === id)
        if (s && /(PO|Entity|DO|Model|DTO)$/.test(s.name)) entities.push({ name: s.name, file: s.file })
      }
    }
    return { endpoint: e, handler: handler ? { name: handler.name, container: handler.container, file: handler.file, line: handler.line } : null, downstream, entities: entities.slice(0, 6) }
  })
  return { ok: true, pattern, count: eps.length, traced }
}

function cmdDeps(file) {
  const rel = Object.keys(index.files).find((f) => f === file || f.endsWith('/' + file))
  if (!rel) return { ok: false, message: `索引里没有 "${file}" —— 可能不是源码文件，或路径写错了。` }
  const e = index.files[rel]
  return {
    ok: true,
    file: rel,
    imports: e.imports.map((i) => ({ spec: i.spec, resolved: i.resolved, external: i.external || null, line: i.line })),
    importedBy: (importers.get(rel) || []).map((f) => ({ file: f, module: index.files[f]?.module })),
    symbols: (e.symbols || []).map((id) => { const s = index.symbols.find((x) => x.id === id); return s ? { name: s.name, kind: s.kind, line: s.line } : null }).filter(Boolean),
  }
}

function cmdMods() {
  const mods = new Map()
  for (const [rel, e] of Object.entries(index.files)) {
    const m = e.module || '(unknown)'
    const cur = mods.get(m) || { module: m, files: 0, symbols: 0, loc: 0 }
    cur.files++
    cur.symbols += e.symbols.length
    cur.loc += e.loc
    mods.set(m, cur)
  }
  return { ok: true, modules: [...mods.values()].sort((a, b) => b.loc - a.loc), crossModuleEdges: index.meta.crossModuleEdges || [] }
}

function cmdStats() {
  return {
    ok: true,
    meta: index.meta,
    topFanIn: index.meta.topFanIn,
    topExternal: index.meta.topExternal?.slice(0, 15),
    hotspots: Object.entries(index.files).sort((a, b) => b[1].loc - a[1].loc).slice(0, 10).map(([file, e]) => ({ file, loc: e.loc, symbols: e.symbols.length })),
  }
}

function cmdFiles(pattern) {
  const needle = (pattern || '').toLowerCase()
  const list = Object.entries(index.files)
    .filter(([rel]) => !needle || rel.toLowerCase().includes(needle))
    .sort((a, b) => b[1].loc - a[1].loc)
    .slice(0, opts.limit)
    .map(([rel, e]) => ({ file: rel, loc: e.loc, lang: e.lang, symbols: e.symbols.length, module: e.module }))
  return { ok: list.length > 0, pattern, count: list.length, files: list }
}

// ------------------------------------------------------------------ 输出

let result
switch (cmd) {
  case 'where': result = cmdWhere(rest[0]); break
  case 'refs': result = cmdRefs(rest[0]); break
  case 'callers': result = cmdCallers(rest[0]); break
  case 'callees': result = cmdCallees(rest[0]); break
  case 'impact': result = cmdImpact(rest[0]); break
  case 'route': result = cmdRoute(rest[0]); break
  case 'mods': result = cmdMods(); break
  case 'deps': result = cmdDeps(rest[0]); break
  case 'stats': result = cmdStats(); break
  case 'files': result = cmdFiles(rest[0]); break
  default: usage(); process.exit(cmd ? 2 : 0)
}

if (opts.json) {
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

// 人类可读输出：短、可扫、带文件行号
const print = (s = '') => console.log(s)
if (!result.ok) { print(`✗ ${result.message || '没有结果'}`); process.exit(1) }

if (cmd === 'where') {
  print(`${result.query} → ${result.results.length} 处定义`)
  for (const r of result.results) print(`  ${r.kind.padEnd(10)} ${(r.container ? r.container + '.' : '') + r.name}  ${r.file}:${r.line}\n             ${r.snippet}`)
}
if (cmd === 'refs') {
  print(`${result.query} → ${result.references.length} 个文件引用`)
  for (const r of result.references) {
    print(`  ${r.file}  ×${r.count}  [${r.module || '-'}]`)
    for (const h of r.hits) print(`      ${String(h.line).padStart(5)}  ${h.text}`)
  }
}
if (cmd === 'callers') {
  print(`${result.query} → ${result.callers.length} 个候选调用方`)
  for (const c of result.callers) print(`  [${c.confidence}] ${c.file} ×${c.count}  ${c.reason}`)
  print('\nhigh = 导入了定义文件；medium = 仅名字匹配，需人工确认。')
}
if (cmd === 'callees') {
  print(`${result.symbol.container ? result.symbol.container + '.' : ''}${result.symbol.name}  ${result.symbol.file}:${result.symbol.line}`)
  print('  已知下游：')
  for (const k of result.resolved) print(`    ${k.name} ×${k.calls}${k.ambiguous ? `  [同名 ${k.ambiguous} 处，需按类型确认]` : ''}  ${k.definitions.join(', ')}`)
  if (result.unresolved.length) {
    print('  未定义/外部（可能是库调用或同包类）：')
    for (const u of result.unresolved) print(`    ${u.name} ×${u.calls}`)
  }
}
if (cmd === 'impact') {
  print(`影响面：${result.target.files.join(', ')}`)
  for (const d of result.byDepth) {
    print(`  第 ${d.depth} 层：${d.files} 个文件（high ${d.high.length} / medium ${d.medium.length}）`)
    for (const h of d.high.slice(0, 12)) print(`    [high]   ${h.file}  ← ${h.via}`)
    for (const m of d.medium.slice(0, 12)) print(`    [medium] ${m.file}  ← ${m.via}`)
  }
  print(`  合计：${result.summary.files} 个文件、${result.summary.symbols} 个符号、模块 ${result.summary.modules.join(', ')}`)
  print('')
  for (const c of result.caveat) print(`  ! ${c}`)
}
if (cmd === 'route') {
  print(`匹配 ${result.count} 个端点，展示前 ${result.traced.length} 个：`)
  for (const t of result.traced) {
    print(`\n  ${t.endpoint.method} ${t.endpoint.path}   (${t.endpoint.file}:${t.endpoint.line})`)
    print(`    处理器：${t.handler ? `${t.handler.container || ''}.${t.handler.name}  ${t.handler.file}:${t.handler.line}` : '未在索引里找到（可能是继承来的方法）'}`)
    if (t.downstream.length) {
      print('    下游调用（名字级，未做类型推断）：')
      for (const d of t.downstream) print(`      ${d.name}  ${d.file}:${d.line}`)
    }
    if (t.entities.length) print(`    涉及模型：${t.entities.map((e) => e.name).join(', ')}`)
  }
}
if (cmd === 'mods') {
  print('模块：')
  for (const m of result.modules) print(`  ${m.module.padEnd(28)} ${String(m.files).padStart(4)} 文件  ${String(m.symbols).padStart(6)} 符号  ${String(m.loc).padStart(7)} 行`)
  if (result.crossModuleEdges.length) {
    print('\n跨模块依赖（import 计数）：')
    for (const e of result.crossModuleEdges.sort((a, b) => b.count - a.count).slice(0, 20)) print(`  ${e.from} → ${e.to}  ×${e.count}`)
  }
}
if (cmd === 'deps') {
  print(`${result.file}\n  导入：`)
  for (const i of result.imports) print(`    ${i.spec}  ${i.resolved ? '→ ' + i.resolved : i.external ? `(外部 ${i.external})` : '(未解析)'}`)
  print('  被导入：')
  for (const i of result.importedBy) print(`    ${i.file}  [${i.module || '-'}]`)
  print(`  定义：${result.symbols.map((s) => s.name).join(', ') || '（无）'}`)
}
if (cmd === 'stats') {
  const m = result.meta
  print(`仓库：${m.name}   文件 ${m.files}   符号 ${m.symbols}   内部导入边 ${m.edges.internalImports}`)
  print(`抽取覆盖：${m.coverage.languages.join(', ')}${m.coverage.minifiedSkipped ? `（跳过 ${m.coverage.minifiedSkipped} 个压缩产物）` : ''}`)
  print(`符号构成：${Object.entries(m.byKind).map(([k, v]) => `${k} ${v}`).join(' / ')}`)
  print('\n被引用最多的文件（改它风险最大）：')
  for (const f of result.topFanIn.slice(0, 10)) print(`  ${String(f.importedBy).padStart(4)}  ${f.file}`)
  print('\n最大的文件：')
  for (const h of result.hotspots) print(`  ${String(h.loc).padStart(6)} 行  ${h.file}  (${h.symbols} 符号)`)
  print(`\n! ${m.coverage.note}`)
}
if (cmd === 'files') {
  print(`匹配 ${result.count} 个文件（按行数降序，最多 ${opts.limit}）`)
  for (const f of result.files) print(`  ${String(f.loc).padStart(6)} 行  ${String(f.symbols).padStart(3)} 符号  ${f.file}  [${f.module || '-'}]`)
}
