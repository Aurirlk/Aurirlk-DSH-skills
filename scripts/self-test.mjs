// 插件入口的单元测试：用 mock 的 Cordis ctx 调 apply()，检查注册结果。
// 放在仓库根跑：node scripts/self-test.mjs   （本文件不随包发布）
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const mod = await import(pathToFileURL(join(repoRoot, 'index.js')).href)

let pass = 0, fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { console.log(`  ✅ ${name}`); pass++ }
  else { console.log(`  ❌ ${name}${extra ? '  → ' + extra : ''}`); fail++ }
}

console.log('=== disk-butler 插件入口自检 ===')

check('导出 name', mod.name === 'disk-butler', `实际 ${mod.name}`)
check('导出 inject 含 skills', Array.isArray(mod.inject) && mod.inject.includes('skills'))
check('导出 apply 函数', typeof mod.apply === 'function')

// mock Cordis ctx
const registrations = []
let effectDisposer = null
const ctx = {
  effect(fn) {                       // Cordis 的 effect：立即执行并保留 disposer
    effectDisposer = fn()
    return effectDisposer
  },
  skills: {
    register(def) {
      registrations.push(def)
      return () => {}                // 模拟 disposer
    },
  },
}

mod.apply(ctx)

check('恰好注册 1 个技能', registrations.length === 1, `实际 ${registrations.length}`)
const reg = registrations[0] ?? {}
check('技能名正确', reg.name === 'disk-butler', `实际 ${reg.name}`)
check('description 非空', typeof reg.description === 'string' && reg.description.length > 20,
      `长度 ${reg.description?.length ?? 0}`)
check('description 未被 YAML 前缀污染', !String(reg.description).startsWith('---'))
check('content 非空', typeof reg.content === 'string' && reg.content.length > 500,
      `长度 ${reg.content?.length ?? 0}`)
check('content 未包含 frontmatter', !String(reg.content).startsWith('---'))
// 不硬编码标题文本——标题改过（磁盘管家 → 电脑管家）就会让这条假失败。
// 只要求：正文里有一级标题，且包含应有的主线小节。
const body = String(reg.content)
check('content 是正文（含一级标题）', /^#\s+\S/m.test(body))
check('content 含两条主线的分节', body.includes('查询线') && body.includes('清理线'))
check('resourceBase 是目录型且指向技能根',
      reg.resourceBase?.kind === 'directory' && existsSync(reg.resourceBase.path),
      JSON.stringify(reg.resourceBase))
check('resourceBase 下能解析 scripts/', existsSync(join(reg.resourceBase.path, 'scripts', 'Find-Junk.ps1')))
check('resourceBase 下能解析 references/', existsSync(join(reg.resourceBase.path, 'references', '垃圾分类判据.md')))
check('effect 被使用（可卸载）', effectDisposer !== null)

// ---------------------------------------------------------------- 解析器单元测试
// 这一段锁住一个真实修过的 bug：原实现用 startsWith('---\n') 判断 frontmatter 开头，
// 在 **CRLF 行尾**的文件上直接失效 → 技能描述被静默丢弃（不报错，只是目录里少一行）。
// Windows 编辑器默认 CRLF，所以这个用例必须存在。
console.log('\n=== splitSkillDocument 解析器 ===')

const parse = mod.splitSkillDocument
check('解析器已导出', typeof parse === 'function')

const DOC_LF = '---\nname: x\ndescription: 这是描述\n---\n\n# 标题\n正文\n'
const DOC_CRLF = DOC_LF.replace(/\n/g, '\r\n')

const lf = parse(DOC_LF)
const crlf = parse(DOC_CRLF)

check('LF：解析出 description', lf.description === '这是描述', `实际 ${JSON.stringify(lf.description)}`)
check('LF：正文不含 frontmatter', lf.body.startsWith('# 标题'), JSON.stringify(lf.body.slice(0, 20)))

check('CRLF：解析出 description', crlf.description === '这是描述', `实际 ${JSON.stringify(crlf.description)}`)
check('CRLF：正文不含 frontmatter', crlf.body.startsWith('# 标题'), JSON.stringify(crlf.body.slice(0, 20)))
check('LF 与 CRLF 结果一致', lf.description === crlf.description && lf.body === crlf.body)

const noFm = parse('# 只有正文\n没有 frontmatter\n')
check('无 frontmatter：description 为 undefined', noFm.description === undefined)
check('无 frontmatter：正文原样返回', noFm.body.includes('只有正文'))

const unclosed = parse('---\nname: x\ndescription: 未闭合\n没有结束标记\n')
check('frontmatter 未闭合：退回整篇作为正文', unclosed.description === undefined && unclosed.body.startsWith('---'))

// YAML 允许把值写成带引号的形式
check('带引号的 description 会去引号', parse('---\ndescription: "引号里的描述"\n---\n正文').description === '引号里的描述')
check('带单引号的 description 会去引号', parse("---\ndescription: '单引号描述'\n---\n正文").description === '单引号描述')

// description 后面的键不应被当成 description 的一部分
check('只取 description，不吞后续键',
      parse('---\nname: x\ndescription: 描述\nwhenToUse: 用途\n---\n正文').description === '描述')

// 真实文件的 CRLF 变体也必须能解析
const realRaw = readFileSync(join(repoRoot, 'skills', 'disk-butler', 'SKILL.md'), 'utf8')
const realCrlf = parse(realRaw.replace(/\r?\n/g, '\r\n'))
check('真实 SKILL.md 转成 CRLF 后仍能解析出描述',
      typeof realCrlf.description === 'string' && realCrlf.description.length > 20,
      `长度 ${realCrlf.description?.length ?? 0}`)

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
