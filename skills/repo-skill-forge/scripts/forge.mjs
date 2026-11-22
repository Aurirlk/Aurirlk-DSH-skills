#!/usr/bin/env node
// 一键跑完整条流水线：scan → index → emit → verify。
//
// 为什么要有这个入口：四步的顺序是硬的（facts 是 index 的输入，两者是 emit 的输入），
// 顺序错了不会报错，只会生成一份内容为空或过期的包。与其让人记顺序，不如让脚本记。
//
// 用法：
//   node forge.mjs <仓库路径> [--out <包目录>] [--name slug] [--strict] [--json]
// 退出码：0 = 通过；1 = 生成成功但校验失败（通常是 TODO 没补完）；2 = 参数或环境问题。
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const opts = { repo: null, out: null, name: null, strict: false, json: false, quiet: false }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--out') opts.out = argv[++i]
  else if (a === '--name') opts.name = argv[++i]
  else if (a === '--strict') opts.strict = true
  else if (a === '--json') opts.json = true
  else if (a === '--quiet') opts.quiet = true
  else if (a === '-h' || a === '--help') {
    console.log(`用法：node forge.mjs <仓库路径> [--out 包目录] [--name slug] [--strict] [--json]

  ① scan-repo   扫事实（模块/命令/端点/实体/配置键/热点/技术债）
  ② build-index 建符号索引（定义/导入边/引用）
  ③ emit-skills 生成 1 本手册 + 6 个查询技能
  ④ verify      校验（--strict 时 TODO 必须清零）

默认输出目录：当前工作目录下的 <仓库名>-skills（刻意不写进仓库内部）`)
    process.exit(0)
  } else if (!a.startsWith('-')) opts.repo = a
}

if (!opts.repo) { console.error('缺少仓库路径。node forge.mjs <仓库> [--out 目录]'); process.exit(2) }
const repo = resolve(opts.repo)
if (!existsSync(repo)) { console.error(`路径不存在：${repo}`); process.exit(2) }
// 默认写到 cwd，而不是仓库内部：往别人的仓库里塞一个未跟踪目录，很容易被误提交
const out = resolve(opts.out || join(process.cwd(), `${basename(repo)}-skills`))
mkdirSync(join(out, 'repo-index'), { recursive: true })

const steps = [
  ['scan', 'scan-repo.mjs', (extra) => [repo, '--out', join(out, 'repo-index'), ...(opts.name ? ['--name', opts.name] : []), ...extra]],
  ['index', 'build-index.mjs', (extra) => [repo, '--out', join(out, 'repo-index'), '--facts', join(out, 'repo-index', 'facts.json'), ...extra]],
  ['emit', 'emit-skills.mjs', (extra) => ['--facts', join(out, 'repo-index', 'facts.json'), '--index', join(out, 'repo-index', 'index.json'), '--out', out, ...extra]],
  ['verify', 'verify-skillpack.mjs', () => [out, ...(opts.strict ? ['--strict'] : [])]],
]

const results = []
for (const [name, file, buildArgs] of steps) {
  const extra = name === 'verify' ? [] : (opts.quiet ? ['--quiet'] : [])
  const started = Date.now()
  const r = spawnSync(process.execPath, [join(here, file), ...buildArgs(extra)], {
    stdio: name === 'verify' && !opts.json ? 'inherit' : (opts.json ? 'pipe' : 'inherit'),
    encoding: 'utf8',
  })
  const ms = Date.now() - started
  results.push({ step: name, code: r.status, ms })
  if (r.status !== 0) {
    // verify 非 0 是"内容没补完"，不是流水线坏了——区别对待，别让人以为工具出错
    const fatal = name !== 'verify'
    console.error(`\n✗ 第 ${results.length} 步（${name}）失败，退出码 ${r.status}${fatal ? '，流水线中止' : ''}`)
    if (r.stderr) console.error(r.stderr.trim().slice(0, 2000))
    process.exit(fatal ? 2 : 1)
  }
  if (!opts.json && name !== 'verify') console.error(`[forge] ${name} 完成，${ms}ms`)
}

if (opts.json) {
  console.log(JSON.stringify({ ok: true, repo, out, steps: results }, null, 2))
} else {
  console.log('')
  console.log(`技能包已生成：${out}`)
  // bash 里反斜杠是转义字符，Windows 路径要转成正斜杠才复制得动
  const posix = (p) => p.replace(/\\/g, '/')
  console.log(`  安装：cp -r "${posix(join(out, 'skills'))}"/* ~/.workbuddy/skills/`)
  console.log(`  重建：bash "${posix(join(out, 'repo-index', 'bin', 'rebuild.sh'))}"`)
  console.log('')
  if (!opts.strict) {
    console.log('下一步：补完 skills/*-dev-guide/AGENT-CHECKLIST.md 里的待补项，然后')
    console.log(`  node "${join(here, 'verify-skillpack.mjs')}" "${out}" --strict`)
  }
}
