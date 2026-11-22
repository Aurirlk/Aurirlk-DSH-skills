#!/usr/bin/env node
// 技能包校验器 —— 这一层是整套东西里最容易被跳过、也最该存在的一层。
//
// 为什么需要它：生成器写得再准，agent 补 TODO 时也会编路径。一份引用了 20 个
// 不存在文件的"开发手册"，比没有手册更容易骗人：它看起来每条都有出处。
//
// 所以这里做四件硬检查：
//   ① 文档里引用的每一个文件路径，在仓库里真的存在
//   ② 每个模块都有模块册、都在模块总表里出现（覆盖率）
//   ③ 没有残留的 AGENT-TODO（--strict 时）
//   ④ 索引没和磁盘脱节（删了的文件还留在索引里）
//
// 用法：node verify-skillpack.mjs <包根目录> [--strict] [--json] [--allow-todo]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'

const argv = process.argv.slice(2)
const opts = { pack: null, strict: false, json: false, allowTodo: false }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--strict') opts.strict = true
  else if (a === '--json') opts.json = true
  else if (a === '--allow-todo') opts.allowTodo = true
  else if (a === '-h' || a === '--help') { console.log('node verify-skillpack.mjs <包根> [--strict] [--allow-todo] [--json]'); process.exit(0) }
  else if (!a.startsWith('-')) opts.pack = a
}
if (!opts.pack) { console.error('缺少包根目录。'); process.exit(2) }
const pack = resolve(opts.pack)

const errors = []
const warnings = []
const notes = []
const err = (check, detail) => errors.push({ check, detail })
const warn = (check, detail) => warnings.push({ check, detail })

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

if (!existsSync(pack)) { console.error(`包根不存在：${pack}`); process.exit(2) }

// ------------------------------------------------------------------ 1. 结构与 frontmatter

const skillsRoot = join(pack, 'skills')
if (!existsSync(skillsRoot)) {
  console.error('包根下没有 skills/ 目录 —— 这不是一个技能包。')
  process.exit(2)
}
const skillDirs = readdirSync(skillsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
if (!skillDirs.length) err('结构', 'skills/ 下没有任何技能目录')

for (const d of skillDirs) {
  const f = join(skillsRoot, d, 'SKILL.md')
  if (!existsSync(f)) { err('结构', `${d}/SKILL.md 不存在`); continue }
  const raw = readFileSync(f, 'utf8')
  if (!raw.startsWith('---')) { err('结构', `${d}/SKILL.md 缺少 frontmatter`); continue }
  const fm = raw.slice(3, raw.indexOf('\n---', 3))
  const name = /^name:\s*(.+)$/m.exec(fm)?.[1]?.trim()
  const desc = /^description:\s*(.+)$/m.exec(fm)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (!name) err('结构', `${d}/SKILL.md 缺少 name`)
  else if (name !== d) warn('结构', `${d}/SKILL.md 的 name 是 "${name}"，与目录名不一致`)
  if (!desc) err('结构', `${d}/SKILL.md 缺少 description`)
  else if (desc.length <= 20) err('结构', `${d}/SKILL.md 的 description 太短（${desc.length} 字符）`)
  if (!/^#\s+\S/m.test(raw)) err('结构', `${d}/SKILL.md 没有一级标题`)
}

// ------------------------------------------------------------------ 2. 索引

const indexDir = join(pack, 'repo-index')
const indexPath = join(indexDir, 'index.json')
const factsPath = join(indexDir, 'facts.json')
let index = null
let facts = null
if (!existsSync(indexPath)) err('索引', 'repo-index/index.json 不存在')
else {
  try { index = JSON.parse(readFileSync(indexPath, 'utf8')) } catch (e) { err('索引', `index.json 解析失败：${e.message}`) }
}
if (!existsSync(factsPath)) err('索引', 'repo-index/facts.json 不存在')
else {
  try { facts = JSON.parse(readFileSync(factsPath, 'utf8')) } catch (e) { err('索引', `facts.json 解析失败：${e.message}`) }
}
if (index && !index.symbols?.length) err('索引', 'index.json 里没有任何符号')
if (index && !Object.keys(index.files || {}).length) err('索引', 'index.json 里没有任何文件')

const repoRoot = index?.meta?.root || facts?.meta?.root
if (!repoRoot) err('索引', '索引里缺 meta.root，无法校验路径')
else if (!existsSync(repoRoot)) err('索引', `索引记录的仓库路径已不存在：${repoRoot}`)

// 索引与磁盘是否脱节（仓库被改过之后没重建）
if (index && repoRoot && existsSync(repoRoot)) {
  const gone = []
  for (const rel of Object.keys(index.files)) {
    if (!existsSync(join(repoRoot, rel))) gone.push(rel)
  }
  if (gone.length) warn('索引', `${gone.length} 个文件在索引里但磁盘上已不存在（索引过期，建议重建）：${gone.slice(0, 3).join(', ')}`)
  const nf = index.symbols.filter((s) => !existsSync(join(repoRoot, s.file))).length
  if (nf) warn('索引', `${nf} 个符号指向已删除的文件`)
}

// ------------------------------------------------------------------ 3. 文档里的路径是否真实存在

const PATH_RE = /`([^`\n]+)`/g
const looksLikePath = (s) => {
  if (!s.includes('/')) return false
  if (/^(https?:|\$|node |npm |pnpm |git |bash |\.\/mvn|\.\/gradlew)/.test(s)) return false
  if (/[<>*{}]/.test(s)) return false
  if (/^[a-z-]+\//.test(s) && !/\.\w{1,6}/.test(s)) return false // 像 a/b 这种不是文件
  return /\.(java|kt|ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|go|rb|php|cs|rs|sql|md|yml|yaml|json|xml|properties|toml|gradle|prisma|proto|sh|ps1)\b/.test(s)
}
const cleanPath = (s) => s.replace(/[:#]L?\d+(-\d+)?$/, '').replace(/^\.\//, '').trim()

let pathRefs = 0
let pathBad = 0
const badSamples = []
for (const f of walk(join(pack, 'skills')).filter((p) => p.endsWith('.md'))) {
  const text = readFileSync(f, 'utf8')
  const relDoc = relative(pack, f)
  PATH_RE.lastIndex = 0
  let m
  while ((m = PATH_RE.exec(text))) {
    const raw = m[1].trim()
    if (!looksLikePath(raw)) continue
    pathRefs++
    const p = cleanPath(raw)
    const candidates = [
      join(repoRoot || '', p),
      join(dirname(f), p),
      join(pack, p),
    ]
    if (!candidates.some((c) => existsSync(c))) {
      pathBad++
      if (badSamples.length < 12) badSamples.push(`${relDoc}: \`${raw}\``)
    }
  }
}
if (pathBad) err('路径', `${pathBad}/${pathRefs} 个被引用的路径不存在（前几条：${badSamples.slice(0, 5).join('；')}）`)
else if (pathRefs) notes.push(`路径引用 ${pathRefs} 处，全部存在`)

// ------------------------------------------------------------------ 4. 覆盖率

if (facts && index) {
  const devGuide = skillDirs.find((d) => d.endsWith('-dev-guide'))
  if (!devGuide) err('覆盖', '没有 *-dev-guide 技能')
  else {
    const refDir = join(skillsRoot, devGuide, 'references')
    const modulesMd = existsSync(join(refDir, '01-modules.md')) ? readFileSync(join(refDir, '01-modules.md'), 'utf8') : ''
    const missingRow = []
    const missingFile = []
    for (const m of facts.modules || []) {
      if (modulesMd && !modulesMd.includes(m.name)) missingRow.push(m.name)
      const anyFile = existsSync(refDir) && readdirSync(refDir).some((f) => f.startsWith('10-module-') && readFileSync(join(refDir, f), 'utf8').startsWith(`# 模块册 · ${m.name}`))
      if (!missingFile.length && !anyFile) missingFile.push(m.name)
    }
    if (missingRow.length) err('覆盖', `模块总表缺少这些模块：${missingRow.join(', ')}`)
    if (missingFile.length) err('覆盖', `缺少模块册：${missingFile.join(', ')}`)
    if (!missingRow.length && !missingFile.length) notes.push(`模块覆盖：${facts.modules.length}/${facts.modules.length}`)
  }

  // 端点抽检：生产端点的文件必须存在（这些是扫描产物，不该错）
  const eps = (facts.httpEndpoints || []).filter((e) => e.scope === 'production')
  if (repoRoot) {
    const bad = eps.filter((e) => !existsSync(join(repoRoot, e.file)))
    if (bad.length) err('覆盖', `${bad.length} 个端点指向不存在的文件：${bad.slice(0, 3).map((e) => e.file).join(', ')}`)
    else if (eps.length) notes.push(`端点来源文件：${eps.length}/${eps.length} 存在`)
  }
}

// ------------------------------------------------------------------ 5. TODO 残留

const todoMarkers = []
for (const f of walk(join(pack, 'skills')).filter((p) => p.endsWith('.md'))) {
  const text = readFileSync(f, 'utf8')
  // TODO 是跨行的块注释（`<!-- AGENT-TODO: M1 ... -->` 后面还有几行说明），
  // 所以按"开标记"计数，不能要求 --> 在同一行。
  const re = /<!--\s*AGENT-TODO\b[^>]{0,400}/g
  let m
  while ((m = re.exec(text))) todoMarkers.push({ file: relative(pack, f), brief: m[0].replace(/<!--\s*AGENT-TODO:?\s*/, '').slice(0, 60) })
}
if (todoMarkers.length && opts.strict && !opts.allowTodo) {
  err('TODO', `--strict 下仍有 ${todoMarkers.length} 个 AGENT-TODO 未补完`)
} else if (todoMarkers.length) {
  notes.push(`待补标记 ${todoMarkers.length} 个（未加 --strict，仅提示）`)
}

// ------------------------------------------------------------------ 6. 可移植性

for (const f of walk(join(pack, 'skills')).filter((p) => p.endsWith('.md'))) {
  const text = readFileSync(f, 'utf8')
  // 前面不能紧跟字母/斜杠，否则 src/views/home/modules 会被当成 /home/modules
  const abs = text.match(/(?:(?<![\w./-])[A-Z]:\\[^\s`'"]{4,}|(?<![\w./-])\/(?:Users|home)\/[^\s`'"]{3,})/g)
  if (abs) warn('可移植', `${relative(pack, f)} 含绝对路径：${abs.slice(0, 2).join(', ')}`)
}

// ------------------------------------------------------------------ 输出

const result = {
  ok: errors.length === 0,
  pack,
  skills: skillDirs.length,
  pathRefs,
  todoMarkers: todoMarkers.length,
  errors,
  warnings,
  notes,
}

if (opts.json) {
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

console.log(`技能包：${pack}`)
console.log(`技能 ${skillDirs.length} 个 · 路径引用 ${pathRefs} 处 · 待补标记 ${todoMarkers.length} 个`)
console.log('')
for (const n of notes) console.log(`  ✓ ${n}`)
for (const w of warnings) console.log(`  ! ${w.check}：${w.detail}`)
for (const e of errors) console.log(`  ✗ ${e.check}：${e.detail}`)
console.log('')

if (errors.length) {
  console.log(`失败：${errors.length} 个错误 / ${warnings.length} 个警告`)
  process.exit(1)
}
console.log(`通过：0 个错误 / ${warnings.length} 个警告${opts.strict ? '（strict）' : ''}`)
if (todoMarkers.length && !opts.strict) {
  console.log('')
  console.log('注意：还有待补标记。补完再跑 `--strict`，否则这份手册只是半成品。')
}
process.exit(0)
