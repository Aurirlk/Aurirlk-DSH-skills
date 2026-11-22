#!/usr/bin/env node
// 体检脚本自己的测试。
//
// 为什么检查器也要被测：一个「永远输出 ✓」的检查器，比没有检查器更坏——
// 它给出的是虚假的安心。所以这里拿两套夹具跑真进程，断言三件事：
//   ① broken 夹具：该报的必须报出来（含 key 名、prop 名、文件）
//   ② clean 夹具：一条都不许报（里面全是「看起来像问题、其实不是」的陷阱）
//   ③ 陷阱确实被扫到了（展开传参那条要出现在「降级」里），
//      否则「没报」可能只是「没看」，而不是「看过了、判对了」
//
// 用法：node scripts/Test-FrontendHealth.selftest.mjs
// 退出码：0 全过 / 1 有用例失败

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, 'Test-FrontendHealth.mjs')
const fixture = (name) => join(here, 'fixtures', name)

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { console.log(`  ✅ ${name}`); pass++ }
  else { console.log(`  ❌ ${name}${extra ? '  → ' + extra : ''}`); fail++ }
}

function run(dir) {
  let stdout = ''
  let code = 0
  try {
    stdout = execFileSync(process.execPath, [cli, dir, '--json', '--max=0'], { encoding: 'utf8' })
  } catch (e) {
    stdout = String(e.stdout ?? '')
    code = e.status ?? 1
  }
  return { code, report: JSON.parse(stdout) }
}

const pick = (report, check_, pred = () => true) =>
  report.findings.filter((f) => f.check === check_ && pred(f))

console.log('=== Test-FrontendHealth 自检 ===')

// ---------------------------------------------------------------- broken 夹具
console.log('\n--- fixtures/broken：该报的必须报 ---')
const b = run(fixture('broken'))

check('退出码 1（有问题）', b.code === 1, `实际 ${b.code}`)
check('error 数 = 2', b.report.counts.error === 2, JSON.stringify(b.report.counts))
check('warn 数 = 3', b.report.counts.warn === 3, JSON.stringify(b.report.counts))

const col = pick(b.report, 'columns-array')
check('columns 数组字面量：1 条', col.length === 1, `实际 ${col.length}`)
check('columns 报在 index.vue 第 7 行',
  col[0]?.file === 'src/views/demo/list/index.vue' && col[0]?.line === 7,
  JSON.stringify(col[0] && { file: col[0].file, line: col[0].line }))
check('columns 不误报写成函数的 clean.vue',
  !b.report.findings.some((f) => f.file === 'src/views/demo/list/clean.vue'))

const miss = pick(b.report, 'i18n-missing-type')
check('i18n 缺类型：1 条', miss.length === 1, `实际 ${miss.length}`)
check('i18n 缺的正是 route.dataAgent', miss[0]?.detail?.key === 'route.dataAgent', miss[0]?.detail?.key)

const parity = pick(b.report, 'lang-parity')
check('语言包不一致：1 条，指向 en-us', parity.length === 1 && parity[0].detail.langs.join() === 'en-us',
  JSON.stringify(parity.map((f) => f.detail)))

const extraType = pick(b.report, 'i18n-type-without-value')
check('类型有值没有：1 条，正是 common.cancel',
  extraType.length === 1 && extraType[0].detail.key === 'common.cancel',
  JSON.stringify(extraType.map((f) => f.detail.key)))

const neverOverridden = pick(b.report, 'prop-never-overridden')
check('有默认值且从未被传：size', 
  neverOverridden.length === 1 && neverOverridden[0].detail.prop === 'size',
  JSON.stringify(neverOverridden.map((f) => f.detail)))
check('报告的 prop 行号指向成员本身（不是 defineProps 那一行）',
  neverOverridden[0]?.line === 5,
  `实际 ${neverOverridden[0]?.line}`)

check('title 传过了 → 不许报',
  !b.report.findings.some((f) => f.detail?.prop === 'title'))
check('modelValue 由 v-model 传 → 不许报',
  !b.report.findings.some((f) => f.detail?.prop === 'modelValue'))

// 逃逸注释：三条检查必须都认（文档承诺了「加注释就不报」）
console.log('\n--- 逃逸注释 frontend-health-ignore：三条都要认 ---')
check('columns：加了注释的不报',
  !b.report.findings.some((f) => f.check === 'columns-array' && f.file === 'src/views/demo/list/ignored.vue'),
  JSON.stringify(b.report.findings.filter((f) => f.check === 'columns-array').map((f) => f.file)))
check('props：加了注释的不报',
  !b.report.findings.some((f) => f.detail?.prop === 'extra'))
check('i18n：加了注释的不报',
  !b.report.findings.some((f) => String(f.detail?.key ?? '').includes('temp.placeholder')))
check('但没加注释的照样报（说明没把整条检查关掉）',
  b.report.findings.some((f) => f.check === 'columns-array' && f.file === 'src/views/demo/list/index.vue'))

const unusedComp = pick(b.report, 'component-unused')
check('没人用的组件：orphan-card', 
  unusedComp.length === 1 && unusedComp[0].detail.comp === 'orphan-card',
  JSON.stringify(unusedComp.map((f) => f.detail.comp)))

// ---------------------------------------------------------------- clean 夹具
console.log('\n--- fixtures/clean：一条都不许报（全是陷阱）---')
const c = run(fixture('clean'))

check('退出码 0（通过）', c.code === 0, `实际 ${c.code}`)
check('error 0 / warn 0 / info 0', 
  c.report.counts.error === 0 && c.report.counts.warn === 0 && c.report.counts.info === 0,
  JSON.stringify(c.report.counts))
check('没有误报（findings 为空）', c.report.findings.length === 0,
  JSON.stringify(c.report.findings.map((f) => f.message)))

// 陷阱必须真的被扫到：展开传参要出现在「降级」里，而不是无声无息
const spreadSkip = c.report.skipped.filter((s) => s.check === 'props' && /展开方式传参/.test(s.reason))
check('展开传参的组件被标为「无法判定」（说明它确实被扫到了）', spreadSkip.length === 1,
  JSON.stringify(c.report.skipped.map((s) => s.reason)))

// 裸属性 / :active 两种写法都要认成「传了值」，否则 badge-dot 会被误报
check('裸属性 active 与 :label 都算传过值',
  !c.report.findings.some((f) => (f.detail?.comp ?? '').includes('badge-dot')))

// ---------------------------------------------------------------- 命令行契约
console.log('\n--- 命令行契约 ---')
let helpOk = true
try { execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }) } catch { helpOk = false }
check('--help 退出码 0', helpOk)

let badOpt = 0
try { execFileSync(process.execPath, [cli, fixture('clean'), '--only=nope'], { encoding: 'utf8', stdio: 'pipe' }) }
catch (e) { badOpt = e.status ?? -1 }
check('未知检查项 → 退出码 2', badOpt === 2, `实际 ${badOpt}`)

let badPath = 0
try { execFileSync(process.execPath, [cli, join(here, 'fixtures', '__nope__')], { encoding: 'utf8', stdio: 'pipe' }) }
catch (e) { badPath = e.status ?? -1 }
check('路径不存在 → 退出码 2', badPath === 2, `实际 ${badPath}`)

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
