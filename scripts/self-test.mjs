// 合集插件入口的单元测试：用 mock 的 Cordis ctx 调 apply()，检查注册结果。
// 在仓库根跑：node scripts/self-test.mjs   （本文件不随包发布）
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const mod = await import(pathToFileURL(join(repoRoot, 'index.js')).href)

let pass = 0, fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { console.log(`  ✅ ${name}`); pass++ }
  else { console.log(`  ❌ ${name}${extra ? '  → ' + extra : ''}`); fail++ }
}

console.log('=== Aurirlk DSH Skills —— 合集入口自检 ===')

check('导出 name', mod.name === 'aurirlk-dsh-skills', `实际 ${mod.name}`)
check('导出 inject 含 skills', Array.isArray(mod.inject) && mod.inject.includes('skills'))
check('导出 apply 函数', typeof mod.apply === 'function')
check('导出 discoverSkills 函数', typeof mod.discoverSkills === 'function')

// ---------------------------------------------------------------- 技能发现
console.log('\n=== 技能发现 ===')

const skillsRoot = join(repoRoot, 'skills')
const onDisk = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  .filter((e) => existsSync(join(skillsRoot, e.name, 'SKILL.md')))
  .map((e) => e.name)
  .sort()

const discovered = mod.discoverSkills()
check('discoverSkills 至少发现 1 个技能', discovered.length >= 1, `实际 ${discovered.length}`)
check('发现的技能与磁盘一致',
      JSON.stringify(discovered.map((s) => s.name)) === JSON.stringify(onDisk),
      `发现 ${discovered.map((s) => s.name)} / 磁盘 ${onDisk}`)
check('discoverSkills 返回按名称排序',
      JSON.stringify(discovered.map((s) => s.name)) ===
      JSON.stringify([...discovered.map((s) => s.name)].sort()))
check('每个技能都有 SKILL.md', discovered.every((s) => existsSync(s.skillFile)))
check('每个技能都有 README.md（合集要求）',
      discovered.every((s) => existsSync(join(s.dir, 'README.md'))),
      discovered.filter((s) => !existsSync(join(s.dir, 'README.md'))).map((s) => s.name).join(', '))

// ---------------------------------------------------------------- 注册行为
console.log('\n=== 注册行为（mock Cordis ctx）===')

const registrations = []
let effectCount = 0
const ctx = {
  effect(fn) { effectCount++; return fn() },   // Cordis 的 effect：立即执行并保留 disposer
  skills: {
    register(def) { registrations.push(def); return () => {} },
  },
}

mod.apply(ctx)

check('注册数量等于发现的技能数',
      registrations.length === discovered.length,
      `注册 ${registrations.length} / 发现 ${discovered.length}`)
check('每个技能各用一次 effect（可单独卸载）',
      effectCount === discovered.length,
      `effect ${effectCount}`)

for (const s of discovered) {
  const reg = registrations.find((r) => r.name === s.name)
  if (!reg) { check(`技能 ${s.name} 已注册`, false); continue }
  check(`技能 ${s.name} 已注册`, true)
  check(`  ${s.name}：description 非空`,
        typeof reg.description === 'string' && reg.description.length > 20,
        `长度 ${reg.description?.length ?? 0}`)
  check(`  ${s.name}：description 未被 YAML 污染`, !String(reg.description).startsWith('---'))
  check(`  ${s.name}：content 非空`, typeof reg.content === 'string' && reg.content.length > 200,
        `长度 ${reg.content?.length ?? 0}`)
  check(`  ${s.name}：content 不含 frontmatter`, !String(reg.content).startsWith('---'))
  check(`  ${s.name}：content 有正文标题`, /^#\s+\S/m.test(String(reg.content)))
  check(`  ${s.name}：resourceBase 指向技能目录`,
        reg.resourceBase?.kind === 'directory' && reg.resourceBase.path === s.dir,
        JSON.stringify(reg.resourceBase))
}

// disk-butler 特有的结构检查（其它技能不一定有 scripts/references）
const db = registrations.find((r) => r.name === 'disk-butler')
if (db) {
  const base = db.resourceBase.path
  check('disk-butler：resourceBase 下能解析 scripts/', existsSync(join(base, 'scripts', 'Find-Junk.ps1')))
  check('disk-butler：resourceBase 下能解析 references/', existsSync(join(base, 'references', '垃圾分类判据.md')))
  check('disk-butler：content 含两条主线的分节',
        String(db.content).includes('查询线') && String(db.content).includes('清理线'))
}

// ---------------------------------------------------------------- 解析器单元测试
// 这一段锁住一个真实修过的 bug：原先用 startsWith('---\n') 判断 frontmatter 开头，
// 在 **CRLF 行尾**的文件上直接失效 → 技能描述被静默丢弃（不报错，只是目录里少一行）。
// Windows 编辑器默认 CRLF，所以这个用例必须存在。
console.log('\n=== splitSkillDocument 解析器 ===')

const parse = mod.splitSkillDocument

const DOC_LF = '---\nname: x\ndescription: 这是描述\n---\n\n# 标题\n正文\n'
const DOC_CRLF = DOC_LF.replace(/\n/g, '\r\n')

const lf = parse(DOC_LF)
const crlf = parse(DOC_CRLF)

check('LF：解析出 description', lf.description === '这是描述', `实际 ${JSON.stringify(lf.description)}`)
check('LF：正文不含 frontmatter', lf.body.startsWith('# 标题'))
check('CRLF：解析出 description', crlf.description === '这是描述', `实际 ${JSON.stringify(crlf.description)}`)
check('CRLF：正文不含 frontmatter', crlf.body.startsWith('# 标题'))
check('LF 与 CRLF 结果一致', lf.description === crlf.description && lf.body === crlf.body)

const noFm = parse('# 只有正文\n没有 frontmatter\n')
check('无 frontmatter：description 为 undefined', noFm.description === undefined)
check('无 frontmatter：正文原样返回', noFm.body.includes('只有正文'))

const unclosed = parse('---\nname: x\ndescription: 未闭合\n没有结束标记\n')
check('frontmatter 未闭合：退回整篇作为正文', unclosed.description === undefined && unclosed.body.startsWith('---'))

check('带双引号的 description 会去引号', parse('---\ndescription: "引号描述"\n---\n正文').description === '引号描述')
check('带单引号的 description 会去引号', parse("---\ndescription: '单引号描述'\n---\n正文").description === '单引号描述')
check('只取 description，不吞后续键',
      parse('---\nname: x\ndescription: 描述\nwhenToUse: 用途\n---\n正文').description === '描述')

// 真实技能文件的 CRLF 变体也必须能解析
for (const s of discovered) {
  const raw = readFileSync(s.skillFile, 'utf8')
  const asCrlf = parse(raw.replace(/\r?\n/g, '\r\n'))
  check(`真实 ${s.name}/SKILL.md 转 CRLF 后仍能解析出描述`,
        typeof asCrlf.description === 'string' && asCrlf.description.length > 20,
        `长度 ${asCrlf.description?.length ?? 0}`)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
