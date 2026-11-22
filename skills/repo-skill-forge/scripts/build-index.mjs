#!/usr/bin/env node
// 符号索引：把"代码里有什么、谁引用了谁"落成一份可查询的 JSON。
//
// 这是 6 个查询技能（repo-map / symbol-lookup / call-graph / impact-analysis /
// request-trace / change-playbook）的共同底座——6 个技能共用一份索引，
// 不各建一套，否则同一个名字在不同技能里给出不同答案。
//
// 精度声明（必须写在产物里，也必须让用户看见）：
//   定义位置、导入关系 = 语法可确定（confidence: high）
//   "谁调用了它" = 名字级匹配（confidence: medium），同名会误判
//   Java 同包引用不写 import，所以只看 import 图会漏，impact 会额外用名字级兜一层
//
// 用法：node build-index.mjs <仓库路径> --out <输出目录> [--facts facts.json] [--max-files N]
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { walkRepo, readText, INDEXABLE, DEFAULT_IGNORE_DIRS, detectLang } from './lib/walk.mjs'
import { extractFile, collectRefs } from './lib/extract.mjs'

function parseArgs(argv) {
  const args = { root: null, out: null, facts: null, maxFiles: 40000, quiet: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') args.out = argv[++i]
    else if (a === '--facts') args.facts = argv[++i]
    else if (a === '--max-files') args.maxFiles = parseInt(argv[++i], 10) || 40000
    else if (a === '--quiet') args.quiet = true
    else if (a === '-h' || a === '--help') { console.log('node build-index.mjs <repo> [--out dir] [--facts facts.json]'); process.exit(0) }
    else if (!a.startsWith('-')) args.root = a
  }
  if (!args.root) { console.error('缺少仓库路径。用法：node build-index.mjs <repo> [--out dir]'); process.exit(2) }
  args.root = resolve(args.root)
  args.out = resolve(args.out || join(process.cwd(), 'repo-index'))
  return args
}

const args = parseArgs(process.argv)
const warn = (m) => { if (!args.quiet) console.error(`[index] ${m}`) }
const posix = (p) => p.replace(/\\/g, '/')

// ------------------------------------------------------------------ 项目别名（tsconfig paths）

function readJsonLoose(text) {
  // tsconfig / jsconfig 允许注释和尾逗号，JSON.parse 会直接失败
  const stripped = String(text)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1')
  return JSON.parse(stripped)
}

const tsPaths = []
for (const file of ['tsconfig.json', 'jsconfig.json', 'tsconfig.app.json']) {
  const p = join(args.root, file)
  if (!existsSync(p)) continue
  try {
    const json = readJsonLoose(readFileSync(p, 'utf8'))
    const opts = json.compilerOptions || {}
    const baseUrl = (opts.baseUrl || '.').replace(/^\.\//, '').replace(/\/$/, '')
    for (const [pattern, targets] of Object.entries(opts.paths || {})) {
      const target = Array.isArray(targets) ? targets[0] : targets
      if (!target) continue
      const prefix = pattern.replace(/\*$/, '')
      const tgt = String(target).replace(/\*$/, '')
      tsPaths.push({ prefix, target: posix(join(baseUrl, tgt)) })
    }
  } catch { /* 配置坏了不影响索引，只是别名解析会退化成猜测 */ }
}
// 常见约定：即使没有 tsconfig，@/ 和 ~/ 也是 src 的别名
if (!tsPaths.length) tsPaths.push({ prefix: '@/...', target: 'src/' }, { prefix: '~/...', target: 'src/' })

// ------------------------------------------------------------------ 遍历与抽取

const walkStart = Date.now()
const { files: allFiles, skipped } = walkRepo(args.root, { ignore: DEFAULT_IGNORE_DIRS, maxFiles: args.maxFiles })
const files = allFiles.filter((f) => INDEXABLE.has(f.lang || ''))
warn(`扫描 ${files.length} 个源码文件（共 ${allFiles.length} 个文本文件），${Date.now() - walkStart}ms`)

const fileSet = new Set(files.map((f) => f.rel))
// byName 必须用 null 原型：符号名可能叫 constructor / toString / __proto__，
// 普通对象字面量会命中原型上的成员，`||= []` 直接抛 "push is not a function"。
const index = { files: Object.create(null), symbols: [], byName: Object.create(null), meta: {} }
const javaFqcn = new Map()   // com.a.B → rel
const pkgOf = new Map()      // rel → package

let minified = 0
const extractStart = Date.now()

for (const f of files) {
  let text
  try { text = readText(f.abs, 800_000) } catch { continue }
  if ((f.lang === 'js' || f.lang === 'ts') && f.lines <= 3 && f.size > 20000) { minified++; continue }

  const ext = extractFile(f.rel, text, f.lang)
  const entry = { lang: f.lang, loc: f.lines, test: f.test, package: ext.package || null, symbols: [], imports: [], refs: Object.create(null) }
  index.files[f.rel] = entry
  if (ext.package) {
    pkgOf.set(f.rel, ext.package)
    javaFqcn.set(ext.package + '.' + basename(f.rel).replace(/\.[^.]+$/, ''), f.rel)
  }

  // Vue/Svelte 的"组件"没有声明语句，文件本身就是组件。
  // 不补这一条，where 查页面名永远查不到——而页面名恰恰是人最常查的。
  if ((f.lang === 'vue' || f.lang === 'svelte') && !/^(index|app|main)$/i.test(basename(f.rel).replace(/\.\w+$/, ''))) {
    const compName = basename(f.rel).replace(/\.(vue|svelte)$/, '').split(/[-_.\s]/).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join('')
    const id = `${f.rel}#1#${compName}`
    index.symbols.push({ id, name: compName, kind: 'component', file: f.rel, line: 1, container: null, exported: true })
    entry.symbols.push(id)
    if (!index.byName[compName]) index.byName[compName] = []
    index.byName[compName].push(id)
  }

  for (const s of ext.symbols) {
    // id 用 file#line#name，同一文件里的重载不会互相覆盖
    const id = `${f.rel}#${s.line}#${s.name}`
    const sym = {
      id, name: s.name, kind: s.kind, file: f.rel, line: s.line,
      container: s.container || null, exported: !!s.exported,
      ...(s.params !== undefined ? { params: s.params } : {}),
      ...(s.extends?.length ? { extends: s.extends } : {}),
      ...(s.implements?.length ? { implements: s.implements } : {}),
    }
    index.symbols.push(sym)
    entry.symbols.push(id)
    if (!index.byName[s.name]) index.byName[s.name] = []
    index.byName[s.name].push(id)
  }

  // 组件契约单独放：这是"页面怎么被用"的事实，dev-guide 与 change-playbook 都要用
  if (ext.components?.length) entry.components = ext.components

  for (const imp of ext.imports) entry.imports.push({ spec: imp.spec, kind: imp.kind, line: imp.line, resolved: null })

  const refs = collectRefs(text)
  // 每文件只留前 400 个高频名字：防止个别巨型文件把索引撑成几十兆
  const top = [...refs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 400)
  for (const [name, count] of top) entry.refs[name] = count
}

warn(`抽取完成：${index.symbols.length} 个符号，${Date.now() - extractStart}ms${minified ? `，跳过 ${minified} 个压缩产物` : ''}`)

// ------------------------------------------------------------------ 解析导入

function tryExt(base) {
  const cands = [
    base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`,
    `${base}.vue`, `${base}.svelte`, `${base}.py`, `${base}.go`, `${base}.java`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.vue`,
    `${base}/__init__.py`, `${base}/index.py`,
  ]
  return cands.find((c) => fileSet.has(c)) || null
}

function resolveSpec(spec, fromRel, lang) {
  if (!spec) return { resolved: null }
  // 相对路径
  if (spec.startsWith('.')) {
    const base = posix(join(dirname(fromRel), spec))
    const hit = tryExt(base)
    return hit ? { resolved: hit } : { resolved: null, missing: true }
  }
  // 别名
  for (const p of tsPaths) {
    if (p.prefix.endsWith('...')) {
      const bare = p.prefix.slice(0, -3)
      if (spec.startsWith(bare)) {
        const hit = tryExt(posix(join(p.target, spec.slice(bare.length))))
        if (hit) return { resolved: hit }
      }
    } else if (spec === p.prefix || spec.startsWith(p.prefix + '/')) {
      const hit = tryExt(posix(join(p.target, spec.slice(p.prefix.length))))
      if (hit) return { resolved: hit }
    }
  }
  // Java：全限定类名 / 通配包
  if (lang === 'java' || lang === 'kotlin') {
    if (spec.endsWith('.*')) return { packageWildcard: spec.slice(0, -2) }
    if (javaFqcn.has(spec)) return { resolved: javaFqcn.get(spec) }
    // 同包类
    const simple = spec.split('.').pop()
    const pkg = pkgOf.get(fromRel)
    if (pkg && javaFqcn.has(`${pkg}.${simple}`)) return { resolved: javaFqcn.get(`${pkg}.${simple}`) }
    return { external: spec }
  }
  // 裸模块名：@scope/pkg/sub → @scope/pkg
  const parts = spec.split('/')
  const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  return { external: pkg }
}

let internalEdges = 0
let externalSpecs = new Map()
for (const [rel, entry] of Object.entries(index.files)) {
  for (const imp of entry.imports) {
    const r = resolveSpec(imp.spec, rel, entry.lang)
    imp.resolved = r.resolved || null
    if (r.external) { imp.external = r.external; externalSpecs.set(r.external, (externalSpecs.get(r.external) || 0) + 1) }
    if (r.packageWildcard) imp.packageWildcard = r.packageWildcard
    if (r.missing) imp.missing = true
    if (r.resolved) internalEdges++
  }
  // 反查表：谁导入了我（impact 的 high 置信来源）
}
// 组件使用边：<UserAvatar /> 是"真依赖"，但语法上不是 import。
// 不补这条，Vue 组件的 impact 只能靠名字猜（实测会冒出 stop / transcribe 这种同名误判）。
const componentByName = new Map()
for (const s of index.symbols) if (s.kind === 'component') componentByName.set(s.name, s.file)
let componentEdges = 0
for (const [rel, e] of Object.entries(index.files)) {
  for (const c of e.components || []) {
    if (c.kind !== 'component') continue
    const target = componentByName.get(c.name)
    if (!target || target === rel) continue
    if (e.imports.some((i) => i.resolved === target)) continue
    e.imports.push({ spec: c.name, kind: 'component', line: 0, resolved: target })
    componentEdges++
  }
}
internalEdges += componentEdges
if (componentEdges) warn(`组件使用边：${componentEdges} 条（模板/JSX 里的大写标签）`)

warn(`导入解析：${internalEdges} 条内部边，${externalSpecs.size} 个外部包`)

// ------------------------------------------------------------------ 模块归属

let moduleOf = () => null
if (args.facts && existsSync(args.facts)) {
  try {
    const facts = JSON.parse(readFileSync(args.facts, 'utf8'))
    const mods = [...(facts.modules || [])].sort((a, b) => (b.path || '').length - (a.path || '').length)
    moduleOf = (rel) => {
      const m = mods.find((x) => !x.path || rel === x.path || rel.startsWith(x.path + '/'))
      return m ? m.name : null
    }
  } catch { warn('facts.json 读不了，模块归属退化为按顶层目录') }
}
if (!args.facts) {
  moduleOf = (rel) => (rel.includes('/') ? rel.split('/')[0] : '(root)')
}
for (const s of index.symbols) s.module = moduleOf(s.file)
for (const [rel, e] of Object.entries(index.files)) e.module = moduleOf(rel)

// ------------------------------------------------------------------ 统计

const byKind = Object.create(null)
for (const s of index.symbols) {
  // 同样要防 'constructor' 这类 kind 命中原型链
  byKind[s.kind] = (Object.prototype.hasOwnProperty.call(byKind, s.kind) ? byKind[s.kind] : 0) + 1
}

const fanIn = new Map()
for (const [, e] of Object.entries(index.files)) {
  for (const imp of e.imports) if (imp.resolved) fanIn.set(imp.resolved, (fanIn.get(imp.resolved) || 0) + 1)
}
const topFanIn = [...fanIn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([file, count]) => ({ file, importedBy: count }))

const crossModule = new Map()
for (const [rel, e] of Object.entries(index.files)) {
  for (const imp of e.imports) {
    if (!imp.resolved) continue
    const from = e.module
    const to = index.files[imp.resolved]?.module
    if (!from || !to || from === to) continue
    const key = `${from}\u0000${to}`
    crossModule.set(key, (crossModule.get(key) || 0) + 1)
  }
}

index.meta = {
  root: args.root,
  name: basename(args.root),
  builtAt: new Date().toISOString(),
  files: Object.keys(index.files).length,
  symbols: index.symbols.length,
  edges: { internalImports: internalEdges, componentUses: componentEdges, externalPackages: externalSpecs.size },
  byKind,
  modules: [...new Set(Object.values(index.files).map((e) => e.module).filter(Boolean))],
  crossModuleEdges: [...crossModule.entries()].map(([k, count]) => { const [from, to] = k.split('\u0000'); return { from, to, count } }),
  topFanIn,
  topExternal: [...externalSpecs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([pkg, count]) => ({ pkg, files: count })),
  coverage: {
    languages: [...new Set(files.map((f) => f.lang))],
    minifiedSkipped: minified,
    skipped,
    note: '定义与导入为语法级（high）；"谁引用了它"是名字级匹配（medium），同名会误判；Java 同包引用不产生 import 边。',
  },
}

mkdirSync(args.out, { recursive: true })
const outFile = join(args.out, 'index.json')
writeFileSync(outFile, JSON.stringify(index), 'utf8')
warn(`写出 ${outFile}（${(statSync(outFile).size / 1024 / 1024).toFixed(1)} MB）`)

if (!args.quiet) {
  console.log(JSON.stringify({
    ok: true,
    out: outFile,
    files: index.meta.files,
    symbols: index.meta.symbols,
    internalImports: internalEdges,
    modules: index.meta.modules.length,
    byKind,
  }, null, 2))
}
