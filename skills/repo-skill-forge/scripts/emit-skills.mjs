#!/usr/bin/env node
// 技能包生成器：把 facts.json + index.json 渲染成「1 个 dev-guide + 6 个查询技能」。
//
// 一件必须说清的事：**这里生成的不是"理解"，是"结构化的入口"**。
// 机械部分（模块清单、端点目录、配置键、热点、命令出处）全部由脚本填，
// 判断部分（这个模块为什么这么分层、改它容易踩什么）留成带编号的 AGENT-TODO，
// 由 agent 读代码后补。理由很直接：脚本猜出来的"职责"一定错，而一份写着错职责的
// 手册比没有手册更糟——后面每个新人都先被它误导一遍。
//
// 行数从哪来：不是灌水，是把人真要查的东西铺开——每个模块一册、每个端点一行、
// 每张表一行、每个配置键一行。真实中等仓库通常在 1500~3500 行。
//
// 用法：node emit-skills.mjs --facts <facts.json> --index <index.json> --out <包根目录>
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// ------------------------------------------------------------------ 参数

function parseArgs(argv) {
  const a = { facts: null, index: null, out: null, quiet: false }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--facts') a.facts = argv[++i]
    else if (k === '--index') a.index = argv[++i]
    else if (k === '--out') a.out = argv[++i]
    else if (k === '--quiet') a.quiet = true
    else if (k === '-h' || k === '--help') { console.log('node emit-skills.mjs --facts <facts.json> --index <index.json> --out <包根>'); process.exit(0) }
  }
  if (!a.facts || !a.index || !a.out) { console.error('需要 --facts、--index、--out 三个参数'); process.exit(2) }
  a.out = resolve(a.out)
  return a
}
const args = parseArgs(process.argv)
const facts = JSON.parse(readFileSync(resolve(args.facts), 'utf8'))
const index = JSON.parse(readFileSync(resolve(args.index), 'utf8'))

const SLUG = facts.meta.name
const REPO = facts.meta.root
const STAMP = new Date().toISOString().slice(0, 10)
const HEAD = facts.meta.git?.head || 'unknown'
const skillsDir = join(args.out, 'skills')
const indexDir = join(args.out, 'repo-index')

const written = []
function emit(rel, content) {
  const p = join(args.out, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content, 'utf8')
  written.push({ rel, lines: content.split('\n').length })
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const code = (s) => '`' + String(s ?? '') + '`'
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(0) + '%' : '—')

// ------------------------------------------------------------------ 派生数据

const moduleOf = (rel) => {
  const mods = [...facts.modules].sort((a, b) => (b.path || '').length - (a.path || '').length)
  const m = mods.find((x) => !x.path || rel === x.path || rel.startsWith(x.path + '/'))
  return m ? m.name : '(未归属)'
}
const endpointByModule = new Map()
for (const e of facts.httpEndpoints.filter((x) => x.scope === 'production')) {
  const m = moduleOf(e.file)
  if (!endpointByModule.has(m)) endpointByModule.set(m, [])
  endpointByModule.get(m).push(e)
}
const entityByModule = new Map()
for (const e of facts.entities.filter((x) => x.scope === 'production')) {
  const m = moduleOf(e.file)
  if (!entityByModule.has(m)) entityByModule.set(m, [])
  entityByModule.get(m).push(e)
}
const filesByModule = new Map()
for (const [rel, e] of Object.entries(index.files)) {
  const m = e.module || '(未归属)'
  if (!filesByModule.has(m)) filesByModule.set(m, [])
  filesByModule.get(m).push({ rel, ...e })
}

// 技术栈：从依赖名推断，推断不出来就直说没推断出来
const ALL_DEPS = [
  ...new Set(facts.modules.flatMap((m) => [...(m.deps || []), ...(m.devDeps || [])]).map((d) => String(d).toLowerCase())),
]
const STACK_RULES = [
  [/spring-boot|spring-boot-starter/, 'Spring Boot'],
  [/spring-web|spring-webmvc/, 'Spring MVC'],
  [/mybatis/, 'MyBatis'],
  [/hibernate|spring-data-jpa/, 'JPA / Hibernate'],
  [/mysql|postgresql|mariadb/, '关系库驱动'],
  [/redis|lettuce|jedis/, 'Redis'],
  [/kafka|rocketmq|rabbit/, '消息队列'],
  [/nacos|eureka|consul/, '注册中心'],
  [/vue/, 'Vue'],
  [/naive-ui/, 'Naive UI'],
  [/element-plus|element-ui/, 'Element Plus'],
  [/unocss/, 'UnoCSS'],
  [/tailwind/, 'Tailwind'],
  [/pinia/, 'Pinia'],
  [/vue-router/, 'Vue Router'],
  [/vite/, 'Vite'],
  [/typescript/, 'TypeScript'],
  [/vitest|jest/, 'Vitest/Jest'],
  [/playwright|cypress/, 'E2E 测试'],
  [/express|koa|fastify/, 'Node HTTP 框架'],
  [/fastapi|django|flask/, 'Python Web 框架'],
  [/langchain|langgraph/, 'LangChain'],
  [/netty/, 'Netty'],
  [/grpc/, 'gRPC'],
  [/minio|s3/, '对象存储'],
  [/elasticsearch/, 'Elasticsearch'],
]
const stack = []
for (const [re, label] of STACK_RULES) if (ALL_DEPS.some((d) => re.test(d))) stack.push(label)

// 模块册文件名要稳定：只留字母数字和连字符
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'module'
const moduleFiles = new Map()
for (const m of facts.modules) moduleFiles.set(m.name, `10-module-${slug(m.name)}.md`)

// ------------------------------------------------------------------ 通用片段

const TOC = (rows) => rows.map(([href, title, desc]) => `| [${title}](${href}) | ${desc} |`).join('\n')

const PACK_HINT = `> 本套技能由 **repo-skill-forge** 扫描 \`${SLUG}\` 生成（${STAMP}，HEAD \`${HEAD}\`）。
> 索引根目录 = 本技能包的 \`repo-index/\`，也就是**本 SKILL.md 所在目录的 \`../..\`**；
> 换了机器或挪了目录，用 \`--index\` 显式指定。
> 源仓库路径记在 \`repo-index/index.json\` 的 \`meta.root\` 里（重建时要用）。`

// ------------------------------------------------------------------ dev-guide 各分册

function refOverview() {
  const L = []
  L.push('# 00 · 一眼看懂这个仓库')
  L.push('')
  L.push(`扫描时间 ${facts.meta.scannedAt}，分支 \`${facts.meta.git?.branch || '?'}\`，HEAD \`${HEAD}\`。`)
  L.push('')
  L.push('## 规模')
  L.push('')
  L.push('| 指标 | 数值 |')
  L.push('|---|---:|')
  L.push(`| 文本文件 | ${facts.meta.totals.files.toLocaleString()} |`)
  L.push(`| 源码文件 | ${facts.meta.totals.sourceFiles.toLocaleString()} |`)
  L.push(`| 源码行数（不含测试） | ${facts.meta.totals.sourceLoc.toLocaleString()} |`)
  L.push(`| 测试行数 | ${facts.meta.totals.testLoc.toLocaleString()}（占源码 ${pct(facts.meta.totals.testLoc, facts.meta.totals.sourceLoc)}） |`)
  L.push(`| 模块 | ${facts.modules.length} |`)
  L.push(`| HTTP 端点 | ${facts.httpEndpoints.filter((e) => e.scope === 'production').length} |`)
  L.push(`| 数据模型 | ${facts.entities.filter((e) => e.scope === 'production').length} |`)
  L.push(`| 配置键 | ${facts.configKeys.length} |`)
  L.push('')
  L.push('## 语言分布')
  L.push('')
  L.push('| 语言 | 文件 | 行数 | 占比 |')
  L.push('|---|---:|---:|---:|')
  for (const l of facts.languages.slice(0, 10)) L.push(`| ${l.lang} | ${l.files} | ${l.loc.toLocaleString()} | ${pct(l.loc, facts.meta.totals.loc)} |`)
  L.push('')
  L.push('## 技术栈（从依赖推断，不是猜的）')
  L.push('')
  if (stack.length) L.push(stack.map((s) => `\`${s}\``).join(' · '))
  else L.push('_依赖里没有匹配到已知技术栈特征，需要人工补。_')
  L.push('')
  L.push('## 构建与验证命令（带出处）')
  L.push('')
  L.push('| 用途 | 命令 | 出处 | 可信度 |')
  L.push('|---|---|---|---|')
  for (const c of facts.commands) L.push(`| ${esc(c.label)} | ${code(c.cmd)} | ${esc(c.source)} | ${c.confidence} |`)
  L.push('')
  L.push('`declared` 是从配置里读出来的；`convention` 是按生态惯例推断的，**没跑过就不算数**。')
  L.push('发版前至少跑一次完整校验命令，把输出贴进 PR。')
  L.push('')
  L.push('## 怎么读这套册子')
  L.push('')
  L.push('1. 先读本册和 [`01-modules.md`](01-modules.md)，建立"有哪些模块、谁依赖谁"的骨架。')
  L.push('2. 要动哪个模块，读对应的 `10-module-*.md`。')
  L.push('3. 查具体符号、调用方、影响面，用 `' + `${SLUG}-symbol-lookup` + '` / `' + `${SLUG}-impact-analysis` + '`，不要靠 grep 猜。')
  L.push('4. 改完对照 [`../AGENT-CHECKLIST.md`](../AGENT-CHECKLIST.md) 收尾。')
  L.push('')
  return L.join('\n')
}

function refModules() {
  const L = []
  L.push('# 01 · 模块与依赖')
  L.push('')
  L.push('## 模块清单')
  L.push('')
  L.push('| 模块 | 路径 | 类型 | 文件 | 行数 | 测试 | 主要语言 |')
  L.push('|---|---|---|---:|---:|---:|---|')
  for (const m of [...facts.modules].sort((a, b) => b.loc - a.loc)) {
    L.push(`| [${esc(m.name)}](${moduleFiles.get(m.name)}) | ${code(m.path || '.')} | ${m.kind} | ${m.files} | ${m.loc.toLocaleString()} | ${m.testFiles} | ${m.languages.slice(0, 2).map((l) => l.lang).join(', ') || '—'} |`)
  }
  L.push('')
  L.push('## 仓库内模块依赖（来自清单文件）')
  L.push('')
  const withDeps = facts.modules.filter((m) => m.intraDeps?.length)
  if (withDeps.length) {
    for (const m of withDeps) L.push(`- \`${m.name}\` → ${m.intraDeps.map((d) => '`' + d + '`').join('、')}`)
  } else L.push('_清单文件里没有识别到仓内依赖（可能都是运行时依赖，或模块间通过 API 调用）。_')
  L.push('')
  if (index.meta.crossModuleEdges?.length) {
    L.push('## 跨模块 import 实际流向（代码级，比清单更可信）')
    L.push('')
    L.push('| 从 | 到 | import 次数 |')
    L.push('|---|---|---:|')
    for (const e of [...index.meta.crossModuleEdges].sort((a, b) => b.count - a.count).slice(0, 25)) {
      L.push(`| ${esc(e.from)} | ${esc(e.to)} | ${e.count} |`)
    }
    L.push('')
    L.push('清单文件说"允许依赖"，这张表说"实际依赖"。两者不一致时以代码为准——')
    L.push('尤其要警惕反向流向（下层模块 import 上层），那是循环依赖的起点。')
  }
  L.push('')
  // 文本树
  L.push('## 目录骨架')
  L.push('')
  L.push('```')
  const tops = new Map()
  for (const [rel] of Object.entries(index.files)) {
    const top = rel.includes('/') ? rel.split('/')[0] : '(根目录文件)'
    tops.set(top, (tops.get(top) || 0) + 1)
  }
  for (const [dir, count] of [...tops.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    L.push(`${dir}/  ·  ${count} 个源码文件`)
  }
  L.push('```')
  L.push('')
  return L.join('\n')
}

function refEntrypoints() {
  const L = []
  L.push('# 02 · 入口与启动链路')
  L.push('')
  const eps = facts.entrypoints.filter((e) => e.scope === 'production')
  if (!eps.length) {
    L.push('_没有识别到明确入口（main / SpringBootApplication / 前端挂载点）。_')
    L.push('')
    L.push('如果你知道入口在哪，把它补进这一节，并在 `AGENT-CHECKLIST.md` 里划掉 E1。')
  } else {
    L.push('| 类型 | 位置 | 说明 |')
    L.push('|---|---|---|')
    for (const e of eps) L.push(`| ${e.kind} | ${code(`${e.file}:${e.line}`)} | ${esc(e.detail)} |`)
    L.push('')
    L.push('## 从入口往下走第一跳')
    L.push('')
    L.push('用索引直接看启动类调了谁，比通读 `main` 快：')
    L.push('')
    L.push('```bash')
    const firstMain = eps.find((e) => e.kind === 'java-main')
    if (firstMain) {
      const cls = basename(firstMain.file).replace(/\.\w+$/, '')
      L.push(`node "$PACK/repo-index/bin/query.mjs" callees "${cls}" --index "$PACK/repo-index"`)
    } else {
      L.push('node "$PACK/repo-index/bin/query.mjs" stats --index "$PACK/repo-index"')
    }
    L.push('```')
    L.push('')
    L.push('<!-- AGENT-TODO: E1 读上面这些入口文件，用 3-5 步写出"进程起来之后发生了什么"，')
    L.push('     每步必须指到一个真实文件。不要写"初始化 Spring 容器"这种放之四海皆准的话。 -->')
  }
  L.push('')
  return L.join('\n')
}

function refApi() {
  const L = []
  const eps = facts.httpEndpoints.filter((e) => e.scope === 'production')
  const routes = facts.uiRoutes.filter((e) => e.scope === 'production')
  L.push('# 03 · 接口与路由')
  L.push('')
  if (eps.length) {
    L.push(`## HTTP 端点（${eps.length} 个，按模块分组）`)
    L.push('')
    L.push('路径里的 `{}` 是路径参数；`line` 是映射注解所在行，点进去就是方法头。')
    L.push('')
    for (const [m, list] of [...endpointByModule.entries()].sort((a, b) => b[1].length - a[1].length)) {
      L.push(`### ${m}（${list.length}）`)
      L.push('')
      L.push('| 方法 | 路径 | 处理器 | 位置 |')
      L.push('|---|---|---|---|')
      for (const e of list.sort((a, b) => a.path.localeCompare(b.path))) {
        L.push(`| ${e.method} | ${code(e.path)} | ${esc(e.handler)} | ${code(`${e.file}:${e.line}`)} |`)
      }
      L.push('')
    }
    const unresolved = facts.httpEndpoints.filter((e) => e.resolved === false)
    if (unresolved.length) {
      L.push(`> ${unresolved.length} 个端点的路径是常量表达式且没解析出来，形如 \`<NAME>\`。`)
      L.push('> 这些**不要直接当契约用**，先去常量类里确认。')
      L.push('')
    }
    L.push('## 端点 → 处理器 → 下游的表名怎么查')
    L.push('')
    L.push('```bash')
    const sample = eps[0]
    L.push(`node "$PACK/repo-index/bin/query.mjs" route "${sample.path.split('/').filter(Boolean)[0] || ''}" --index "$PACK/repo-index"`)
    L.push('```')
    L.push('')
    L.push('输出的"下游调用"是名字级匹配，可能混同名方法；看到 `[同名 N 处]` 必须按类型确认。')
    L.push('')
  }
  if (routes.length) {
    L.push(`## 前端路由（${routes.length} 个）`)
    L.push('')
    L.push('| 路径 | 名称 | 位置 |')
    L.push('|---|---|---|')
    for (const r of routes.slice(0, 300)) L.push(`| ${code(r.path)} | ${esc(r.name || '—')} | ${code(`${r.file}:${r.line}`)} |`)
    L.push('')
    L.push('<!-- AGENT-TODO: A1 把"路由 → 页面组件 → 数据来源（哪个 API 文件）"补成一张表。')
    L.push('     只补主流程的 10-20 条，不要把 300 条全抄一遍。 -->')
    L.push('')
  }
  if (!eps.length && !routes.length) {
    L.push('_没有识别到 HTTP 端点或前端路由。这个仓库可能是库、CLI、Worker 或纯前端静态站。_')
    L.push('')
    L.push('<!-- AGENT-TODO: A1 如果不是库，把真正的"对外入口"（命令行参数、消息队列 topic、定时任务）补在这里。 -->')
    L.push('')
  }
  return L.join('\n')
}

function refDataModel() {
  const L = []
  const ents = facts.entities.filter((e) => e.scope === 'production')
  L.push('# 04 · 数据模型')
  L.push('')
  if (!ents.length) {
    L.push('_没有识别到 ORM 实体或 DDL。_')
    L.push('')
    L.push('<!-- AGENT-TODO: D1 若数据落在别处（外部服务 / 对象存储 / 只读视图），把真实存储形态写清楚。 -->')
    L.push('')
    return L.join('\n')
  }
  L.push(`共 ${ents.length} 个模型。表名是**推断**的：\`@TableName\` / \`@Table\` 优先，否则按类名转下划线。`)
  L.push('推断值一律带 `?` 标记的，上线前必须去库里核对。')
  L.push('')
  for (const [m, list] of [...entityByModule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    L.push(`## ${m}（${list.length}）`)
    L.push('')
    L.push('| 模型 | 表 | 来源 | 位置 |')
    L.push('|---|---|---|---|')
    for (const e of list) L.push(`| ${esc(e.name)} | ${e.table ? code(e.table) : '—'} | ${e.source} | ${code(`${e.file}:${e.line}`)} |`)
    L.push('')
  }
  L.push('## 查某个模型被谁用')
  L.push('')
  L.push('```bash')
  const s = ents[0]
  L.push(`node "$PACK/repo-index/bin/query.mjs" impact "src/main/java/.../${s.name}.java" --index "$PACK/repo-index" --depth 1`)
  L.push('```')
  L.push('')
  L.push('<!-- AGENT-TODO: D2 补三件事：① 主键/唯一键策略；② 软删除与审计字段（created_at 之类）谁在写；')
  L.push('     ③ 哪些表是"只增不改"的流水表，清理策略是什么。 -->')
  L.push('')
  return L.join('\n')
}

function refConfig() {
  const L = []
  L.push('# 05 · 配置项')
  L.push('')
  L.push(`共 ${facts.configKeys.length} 个键。**这里只有键名，没有任何值** —— 值里可能有密码、token、内网地址，`)
  L.push('扫描器从设计上就不把它们写进产物。要真实值，去部署环境或密钥管理里拿。')
  L.push('')
  const secrets = facts.configKeys.filter((k) => k.secret)
  if (secrets.length) {
    L.push(`其中 **${secrets.length} 个疑似敏感**（键名含 password/secret/token/key/credential 等）：`)
    L.push('')
    L.push(secrets.map((k) => `- ${code(k.key)}`).join('\n'))
    L.push('')
    L.push('这些键在日志、异常栈、健康检查响应里**都不该出现值**。发版前搜一遍：')
    L.push('')
    L.push('```bash')
    L.push(`grep -rn "${secrets[0].key}" src/ | grep -v '\\.md' | head`)
    L.push('```')
    L.push('')
  }
  L.push('## 全部键')
  L.push('')
  L.push('| 键 | 类型 | 出现位置 | 疑似敏感 |')
  L.push('|---|---|---|---|')
  for (const k of facts.configKeys.slice(0, 400)) {
    L.push(`| ${code(k.key)} | ${k.kind || '—'} | ${esc(k.sources.slice(0, 2).join(', '))} | ${k.secret ? '⚠️' : ''} |`)
  }
  if (facts.configKeys.length > 400) L.push(`\n_只列前 400 个，完整清单在 \`repo-index/facts.json\` 的 \`configKeys\`。_`)
  L.push('')
  L.push('<!-- AGENT-TODO: C1 标出"少一个就起不来"的必填键，以及"有默认值但线上必须覆盖"的键。')
  L.push('     判断依据是代码里有没有兜底，不要凭键名猜。 -->')
  L.push('')
  return L.join('\n')
}

function refConventions() {
  const L = []
  const c = facts.conventions
  L.push('# 06 · 约定与技术债')
  L.push('')
  L.push('这一节全是**统计事实**，不是规范条文。规范要看团队自己的文档；这里回答"这个仓库实际长什么样"。')
  L.push('')
  L.push('## 命名分布')
  L.push('')
  if (c.naming.length) {
    L.push('| 类名后缀 | 数量 |')
    L.push('|---|---:|')
    for (const n of c.naming) L.push(`| ${n.suffix} | ${n.count} |`)
    L.push('')
    L.push('后缀分布能看出分层习惯：`Controller` 多说明按接口分，`Service`/`ServiceImpl` 成对说明走接口注入，')
    L.push('`Handler`/`Chain` 多说明有责任链，`Job`/`Task` 多说明有调度。')
  } else L.push('_没有 Java 类，或类名不符合常见后缀。_')
  L.push('')
  L.push('## 工具链')
  L.push('')
  L.push(`- 包管理器：${c.packageManager || '未识别'}${c.lockfiles.length ? `（${c.lockfiles.join(', ')}）` : ''}`)
  L.push(`- 检查/格式化配置：${c.lintConfigs.length ? c.lintConfigs.map((x) => code(x)).join('、') : '未发现 —— 意味着没有统一格式门禁'}`)
  L.push(`- 测试框架：${c.testFrameworks.join(', ') || '未识别'}`)
  L.push(`- 测试/源码行数比：**${facts.tests.ratio}**（${facts.tests.files} 个测试文件 / ${facts.tests.loc.toLocaleString()} 行）`)
  L.push('')
  L.push('## 代码卫生信号')
  L.push('')
  L.push('| 信号 | 数量 | 怎么看 |')
  L.push('|---|---:|---|')
  L.push(`| \`any\` | ${c.markers.any} | 类型逃逸。集中在大文件里通常意味着 DTO 没定清 |`)
  L.push(`| \`console.log\` 类 | ${c.markers.console} | 生产代码里的调试残留 |`)
  L.push(`| TODO | ${c.markers.todo} | 计划性欠债 |`)
  L.push(`| FIXME | ${c.markers.fixme} | 已知错误没修 |`)
  L.push(`| HACK | ${c.markers.hack} | 绕过方案，通常有隐含前提 |`)
  L.push('')
  L.push(`注释语种：${c.comments.total} 行注释里 ${c.comments.chinese} 行含中文（${(c.comments.chineseRatio * 100).toFixed(0)}%）。`)
  L.push('')
  if (c.todos.length) {
    L.push('## 技术债标记（前 40 条）')
    L.push('')
    L.push('| 类型 | 位置 | 内容 |')
    L.push('|---|---|---|')
    for (const t of c.todos) L.push(`| ${t.kind} | ${code(`${t.file}:${t.line}`)} | ${esc(t.snippet)} |`)
    L.push('')
    L.push('处理顺序建议：`FIXME` 优先于 `HACK`，`HACK` 优先于 `TODO`。')
    L.push('`HACK` 往往带着"暂时绕过"的前提，前提失效时会静默出错，比 TODO 危险。')
  }
  L.push('')
  return L.join('\n')
}

function refLandmines() {
  const L = []
  L.push('# 07 · 地雷区')
  L.push('')
  L.push('按"改它之前必须知道"排序。所有条目都是扫描出来的事实，不是经验之谈。')
  L.push('')
  L.push('## 1. 最大的文件（改动风险最高）')
  L.push('')
  L.push('| 行数 | 文件 | 符号数 |')
  L.push('|---:|---|---:|')
  for (const h of facts.hotspots.slice(0, 20)) {
    const f = index.files[h.file]
    L.push(`| ${h.lines} | ${code(h.file)} | ${f ? f.symbols.length : '—'} |`)
  }
  L.push('')
  L.push('单文件超过 1000 行时，任何"小改动"都要先想清楚：这个文件被多少人同时改？')
  L.push('拆之前先用 `' + `${SLUG}-impact-analysis` + '` 看影响面。')
  L.push('')
  const fanIn = index.meta.topFanIn?.slice(0, 15) || []
  if (fanIn.length) {
    L.push('## 2. 被依赖最多的文件（改签名会炸一片）')
    L.push('')
    L.push('| 被引用次数 | 文件 |')
    L.push('|---:|---|')
    for (const f of fanIn) L.push(`| ${f.importedBy} | ${code(f.file)} |`)
    L.push('')
  }
  const untested = facts.modules.filter((m) => m.files > 20 && m.testFiles === 0)
  if (untested.length) {
    L.push('## 3. 没有测试的模块')
    L.push('')
    for (const m of untested) L.push(`- \`${m.name}\` — ${m.files} 个文件、${m.loc.toLocaleString()} 行，测试 0`)
    L.push('')
    L.push('在这些模块里改动，人工验证的成本远高于有测试的模块。**改完必须手动跑一遍真实路径。**')
    L.push('')
  }
  if (facts.caveats.length) {
    L.push('## 4. 扫描器自己承认的边界')
    L.push('')
    for (const c of facts.caveats) L.push(`- ${c}`)
    L.push('')
    L.push('这些不是免责声明，是"这份册子可能在哪些地方错"的预告。凡涉及这些点，回代码确认。')
    L.push('')
  }
  L.push('<!-- AGENT-TODO: L1 补 3-5 条"只有读过代码才知道"的坑：')
  L.push('     例如某个字段有隐式默认值、某个接口有幂等前提、某个定时任务依赖执行顺序。')
  L.push('     每条必须带 file:line 证据，写不出证据的就不要写。 -->')
  L.push('')
  return L.join('\n')
}

// 目录角色：给人一句"这层是干什么的"，比列一堆路径有用
const DIR_ROLE = [
  // 顺序有讲究：先匹配"更具体"的层。views/xxx/components 是组件，不是页面。
  [/(^|\/)components?($|\/)/, '可复用组件'],
  [/^(src\/)?service\/api($|\/)|^(src\/)?api($|\/)/, '接口封装层'],
  [/(^|\/)hooks?($|\/)|(^|\/)composables?($|\/)/, '组合式函数 / 副作用封装'],
  [/(^|\/)stores?($|\/)/, '状态管理'],
  [/(^|\/)locales?($|\/)/, '文案与语言包'],
  [/(^|\/)router($|\/)/, '路由表'],
  [/(^|\/)layouts?($|\/)/, '布局骨架'],
  [/(^|\/)utils?($|\/)/, '工具函数'],
  [/(^|\/)typings?($|\/)|(^|\/)types?($|\/)/, '类型声明'],
  [/(^|\/)controller($|\/)/, 'HTTP 接入层'],
  [/(^|\/)service($|\/)/, '业务逻辑'],
  [/(^|\/)repository|(^|\/)mapper|(^|\/)dao($|\/)/, '数据访问'],
  [/(^|\/)(entity|po|model)($|\/)/, '持久化模型'],
  [/(^|\/)(dto|vo|request|response)($|\/)/, '传输对象'],
  [/(^|\/)(config|configuration)($|\/)/, '配置装配'],
  [/(^|\/)(job|jobs|task|tasks|scheduler|schedule)($|\/)/, '定时/异步任务'],
  [/(^|\/)(views?|pages?)($|\/)/, '页面（路由落点）'],
  [/(^|\/)test($|\/)/, '测试'],
]
const roleOf = (dir) => (DIR_ROLE.find(([re]) => re.test(dir)) || [null, ''])[1]

function refModule(m) {
  const L = []
  const files = (filesByModule.get(m.name) || []).sort((a, b) => b.loc - a.loc)
  const eps = endpointByModule.get(m.name) || []
  const ents = entityByModule.get(m.name) || []
  L.push(`# 模块册 · ${m.name}`)
  L.push('')
  L.push(`路径 ${code(m.path || '.')} · ${m.kind} · ${m.files} 个文件 · ${m.loc.toLocaleString()} 行 · 测试 ${m.testFiles} 个`)
  if (m.manifest) L.push(`清单：${code(m.manifest)}`)
  L.push('')
  L.push('## 依赖')
  L.push('')
  L.push(`- 仓内依赖：${m.intraDeps?.length ? m.intraDeps.map((d) => '`' + d + '`').join('、') : '无（或未在清单中声明）'}`)
  L.push(`- 外部依赖（前 15）：${(m.deps || []).slice(0, 15).map((d) => '`' + d + '`').join('、') || '无'}`)
  L.push('')
  L.push('## 目录分布')
  L.push('')
  const byDir = new Map()
  for (const f of files) {
    const dir = f.rel.includes('/') ? dirname(f.rel) : '.'
    const cur = byDir.get(dir) || { loc: 0, files: 0 }
    cur.loc += f.loc
    cur.files++
    byDir.set(dir, cur)
  }
  L.push('| 目录 | 角色 | 文件 | 行数 |')
  L.push('|---|---|---:|---:|')
  for (const [dir, v] of [...byDir.entries()].sort((a, b) => b[1].loc - a[1].loc).slice(0, 20)) {
    L.push(`| ${code(dir)} | ${roleOf(dir) || '—'} | ${v.files} | ${v.loc.toLocaleString()} |`)
  }
  L.push('')
  L.push('## 主要文件（按行数）')
  L.push('')
  L.push('| 行数 | 文件 | 符号 |')
  L.push('|---:|---|---:|')
  for (const f of files.slice(0, 15)) L.push(`| ${f.loc} | ${code(f.rel)} | ${f.symbols.length} |`)
  L.push('')
  // 文件清单：这是"这个模块里到底有哪些文件"的唯一权威列表。
  // 只列前 N 个（大模块会到上千），并明确写出截断，避免让人以为这就是全部。
  const FILE_CAP = 400
  L.push('## 文件清单')
  L.push('')
  if (files.length > FILE_CAP) {
    L.push(`本模块共 ${files.length} 个文件，按目录列出前 ${FILE_CAP} 个（按目录聚合，每行：行数 · 符号数）：`)
    L.push('')
  } else {
    L.push(`共 ${files.length} 个文件（每行：行数 · 符号数）：`)
    L.push('')
  }
  const sortedByDir = [...byDir.keys()].sort()
  let printed = 0
  for (const dir of sortedByDir) {
    if (printed >= FILE_CAP) break
    const list = files.filter((f) => (f.rel.includes('/') ? dirname(f.rel) : '.') === dir)
    L.push(`### ${dir}${roleOf(dir) ? ` · ${roleOf(dir)}` : ''}`)
    L.push('')
    for (const f of list.sort((a, b) => b.loc - a.loc)) {
      if (printed >= FILE_CAP) break
      L.push(`- ${code(basename(f.rel))} · ${f.loc} 行 · ${f.symbols.length} 符号`)
      printed++
    }
    L.push('')
  }
  if (files.length > FILE_CAP) {
    L.push(`_还有 ${files.length - FILE_CAP} 个文件未列出，用 \`${SLUG}-repo-map\` 的 \`$Q files <目录>\` 查。_`)
    L.push('')
  }

  const topSymbols = []
  for (const f of files) {
    for (const id of f.symbols) {
      const s = index.symbols.find((x) => x.id === id)
      if (s && s.kind !== 'method' && s.kind !== 'constructor') topSymbols.push(s)
    }
  }
  if (topSymbols.length) {
    L.push('## 对外符号（类型级，前 30 个）')
    L.push('')
    L.push('| 符号 | 类型 | 位置 |')
    L.push('|---|---|---|')
    for (const s of topSymbols.slice(0, 30)) L.push(`| ${esc(s.name)} | ${s.kind} | ${code(`${s.file}:${s.line}`)} |`)
    L.push('')
  }
  if (eps.length) {
    L.push(`## 本模块端点（${eps.length}）`)
    L.push('')
    L.push('| 方法 | 路径 | 处理器 | 位置 |')
    L.push('|---|---|---|---|')
    for (const e of eps.slice(0, 60)) L.push(`| ${e.method} | ${code(e.path)} | ${esc(e.handler)} | ${code(`${e.file}:${e.line}`)} |`)
    if (eps.length > 60) L.push(`\n_只列前 60 个，完整清单见 [03-api.md](03-api.md)。_`)
    L.push('')
  }
  if (ents.length) {
    L.push(`## 本模块模型（${ents.length}）`)
    L.push('')
    for (const e of ents) L.push(`- ${code(e.name)}${e.table ? ' → ' + code(e.table) : ''}（${code(`${e.file}:${e.line}`)}）`)
    L.push('')
  }
  L.push('## 待补（必须读代码才能写，不许猜）')
  L.push('')
  L.push(`<!-- AGENT-TODO: M-${slug(m.name)}-1 用 2-3 句说清这个模块**负责什么、不负责什么**。`)
  L.push('     要求：至少引用 2 个本模块的真实文件作为依据；不要重复上面已经列出的目录表。 -->')
  L.push('')
  L.push(`<!-- AGENT-TODO: M-${slug(m.name)}-2 写出"一次典型请求/任务在这个模块里的流转路径"：`)
  L.push('     从入口函数开始，按调用顺序列 4-6 步，每步带 file:line。')
  L.push('     可以用 `query.mjs callees <类名>` 辅助，但结论要自己核对。 -->')
  L.push('')
  L.push(`<!-- AGENT-TODO: M-${slug(m.name)}-3 列出改动本模块时最容易踩的 2-3 个坑（有证据的）。`)
  L.push('     写不出就删掉这三行 TODO 并注明"未发现特有风险"，不要留着占位。 -->')
  L.push('')
  return L.join('\n')
}

function devGuideSkill() {
  const L = []
  L.push('---')
  L.push(`name: ${SLUG}-dev-guide`)
  L.push(`description: "读懂 ${SLUG} 这个仓库的开发手册 / codebase guide for ${SLUG}. 模块地图、入口链路、端点目录、数据模型、配置项、约定与技术债、地雷区，全部由仓库扫描生成并标注出处；每条结论可回溯到 file:line。Use when you need to understand this codebase, find where something lives, or plan a change that spans modules."`)
  L.push(`whenToUse: "要在这个仓库里加功能/修 bug，但不知道从哪下手；需要确认某模块职责、某端点在哪、某张表对应哪个类；交接给新人或新 agent 时。Also when onboarding onto this repo, locating an endpoint or entity, or planning a cross-module change."`)
  L.push('---')
  L.push('')
  L.push(`# ${SLUG} 开发手册`)
  L.push('')
  L.push(PACK_HINT)
  L.push('')
  L.push('## 这份手册的性质')
  L.push('')
  L.push('**机械部分由脚本生成，判断部分留成编号 TODO 由你补。** 看到 `<!-- AGENT-TODO: -->` 就说明：')
  L.push('这里需要读代码，脚本不敢替你猜。补完把标记删掉，`AGENT-CHECKLIST.md` 上划掉对应编号。')
  L.push('')
  L.push('**铁律两条：**')
  L.push('')
  L.push('1. **每条结论都要能指到 `file:line`。** 写不出出处的句子，删掉比留着好——')
  L.push('   它会让下一个人以为这里被核实过。')
  L.push('2. **这是介绍，不是复盘档案。** 不要写"某次发布失败是因为…"，那是事故记录的位置。')
  L.push('   手册只回答"现在是什么样、要改该动哪"。')
  L.push('')
  L.push('## 目录')
  L.push('')
  L.push('| 分册 | 内容 |')
  L.push('|---|---|')
  L.push(TOC([
    ['references/00-overview.md', '00 · 一眼看懂', '规模、语言、技术栈、构建命令（带出处）'],
    ['references/01-modules.md', '01 · 模块与依赖', '模块清单、跨模块 import 实际流向、目录骨架'],
    ['references/02-entrypoints.md', '02 · 入口与启动链路', '进程/应用从哪起来，第一跳调了什么'],
    ['references/03-api.md', '03 · 接口与路由', '全部端点与前端路由，按模块分组'],
    ['references/04-datamodel.md', '04 · 数据模型', '实体与表名的映射及出处'],
    ['references/05-config.md', '05 · 配置项', '全部键名（值不落盘），敏感键单独标出'],
    ['references/06-conventions.md', '06 · 约定与技术债', '命名分布、工具链、TODO/FIXME/HACK'],
    ['references/07-landmines.md', '07 · 地雷区', '最大文件、被依赖最多的文件、无测试模块'],
  ]))
  L.push('')
  L.push('模块册（要动哪个模块就读哪一册）：')
  L.push('')
  for (const m of [...facts.modules].sort((a, b) => b.loc - a.loc)) {
    L.push(`- [${m.name}](references/${moduleFiles.get(m.name)}) — ${m.loc.toLocaleString()} 行 / ${m.files} 文件`)
  }
  L.push('')
  L.push('## 怎么用（按任务类型）')
  L.push('')
  L.push('| 任务 | 顺序 |')
  L.push('|---|---|')
  L.push(`| 第一次接触这个仓库 | 00 → 01 → 你要动的那一册模块册 → 07 |`)
  L.push(`| 加一个接口 | 03 找到同类端点 → 那册模块 → \`${SLUG}-change-playbook\` |`)
  L.push(`| 改一个已有函数 | \`${SLUG}-impact-analysis\` 先看影响面 → 再读模块册 |`)
  L.push(`| 查某个名字在哪 | \`${SLUG}-symbol-lookup\`（不要 grep 猜） |`)
  L.push(`| 排查"为什么没生效" | 07 地雷区 → 05 配置项 → \`${SLUG}-request-trace\` |`)
  L.push('')
  L.push('## 索引与查询')
  L.push('')
  L.push('手册是**静态**的，代码天天变；索引可以随时重建。这两者冲突时以索引为准。')
  L.push('')
  L.push('```bash')
  L.push('# 重建索引（代码改动较大之后）')
  L.push(`node "$PACK/repo-index/bin/rebuild.sh"`)
  L.push('')
  L.push('# 直接用查询')
  L.push(`node "$PACK/repo-index/bin/query.mjs" where <名字> --index "$PACK/repo-index"`)
  L.push('```')
  L.push('')
  L.push('## 更新这份手册')
  L.push('')
  L.push('手册过期比没有更糟。以下情况必须重扫：')
  L.push('')
  L.push('- 新增/删除模块')
  L.push('- 端点路径批量变化（比如换了网关前缀）')
  L.push('- 模块册里的 TODO 全部补完之后（把补的内容一起提交）')
  L.push('')
  L.push('```bash')
  L.push('bash repo-index/bin/rebuild.sh <仓库路径>   # 路径已记在索引里，可省略')
  L.push('node <repo-skill-forge>/scripts/build-index.mjs <仓库> --out repo-index --facts repo-index/facts.json')
  L.push('node <repo-skill-forge>/scripts/emit-skills.mjs --facts repo-index/facts.json --index repo-index/index.json --out .')
  L.push('```')
  L.push('')
  L.push('## 已知边界')
  L.push('')
  L.push('- 抽取是 regex 级：重载、泛型特化、动态导入会失真。')
  L.push('- 端点路径如果是常量表达式且没在仓里找到定义，会保留为 `<NAME>`，不能当契约。')
  L.push('- 配置只收键名，**没有值**。要真实值去部署环境拿。')
  L.push('')
  return L.join('\n')
}

// ------------------------------------------------------------------ 六个查询技能

const QUERY_SKILLS = [
  {
    dir: 'repo-map',
    title: '仓库地图',
    desc: `在 ${SLUG} 仓库里定位"东西在哪"：模块、目录、文件、符号规模。回答"这个功能大概在哪个模块""哪些文件最大""谁被依赖最多"。Use to orient yourself in this repo before reading code.`,
    when: '不知道从哪下手、需要先看全局；或要判断某模块该不该由自己改。',
    body: (L) => {
      L.push('## 查询')
      L.push('')
      L.push('```bash')
      L.push(`PACK=<本技能包根目录>`)
      L.push(`Q="node $PACK/repo-index/bin/query.mjs"`)
      L.push('')
      L.push('$Q mods  --index "$PACK/repo-index"   # 模块、文件数、符号数、跨模块依赖')
      L.push('$Q stats --index "$PACK/repo-index"   # 规模、被依赖最多的文件、最大文件')
      L.push('$Q files src --index "$PACK/repo-index"  # 按路径片段找文件')
      L.push('```')
      L.push('')
      L.push('## 本仓库速查（扫描时的事实）')
      L.push('')
      L.push('| 模块 | 文件 | 符号 | 行数 |')
      L.push('|---|---:|---:|---:|')
      for (const m of [...facts.modules].sort((a, b) => b.loc - a.loc).slice(0, 10)) {
        const syms = Object.entries(index.files).filter(([, e]) => e.module === m.name).reduce((a, [, e]) => a + e.symbols.length, 0)
        L.push(`| ${esc(m.name)} | ${m.files} | ${syms} | ${m.loc.toLocaleString()} |`)
      }
      L.push('')
      if (index.meta.topFanIn?.length) {
        L.push('被依赖最多的三个文件（改它们之前先想清楚）：')
        L.push('')
        for (const f of index.meta.topFanIn.slice(0, 3)) L.push(`- ${code(f.file)} — 被 ${f.importedBy} 个文件导入`)
        L.push('')
      }
    },
  },
  {
    dir: 'symbol-lookup',
    title: '符号定位',
    desc: `在 ${SLUG} 仓库里找类/方法/函数的定义位置，并列出谁引用了它。替代"全局搜索 + 肉眼翻"。Use to locate a symbol's definition and its references.`,
    when: '知道名字但不知道在哪；改签名前想知道谁在用。',
    body: (L) => {
      L.push('## 查询')
      L.push('')
      L.push('```bash')
      L.push(`PACK=<本技能包根目录>`)
      L.push(`Q="node $PACK/repo-index/bin/query.mjs"`)
      L.push('')
      L.push('$Q where <名字>  --index "$PACK/repo-index"   # 定义在哪')
      L.push('$Q refs  <名字>  --index "$PACK/repo-index"   # 谁提到了它（带行号）')
      L.push('$Q files <片段>  --index "$PACK/repo-index"   # 按路径找')
      L.push('```')
      L.push('')
      L.push('`where` 支持 `类名#方法名` 精确定位，例如 `where AgentController#create`。')
      L.push('')
      L.push('## 结果怎么读')
      L.push('')
      L.push('- `where` 找不到时：可能拼错了、可能是框架反射注册的名字、可能是动态生成。')
      L.push('  先用 `files` 按路径找，再考虑 grep。')
      L.push('- `refs` 是按名字匹配的：同名不同类会一起列出来。看到多个定义时，先 `where` 确认是哪一个。')
      L.push('')
      const sample = index.meta.topFanIn?.[0]?.file ? basename(index.meta.topFanIn[0].file).replace(/\.\w+$/, '') : null
      if (sample) {
        L.push('## 本仓库例子')
        L.push('')
        L.push('```bash')
        L.push(`$Q where ${sample} --index "$PACK/repo-index"`)
        L.push('```')
        L.push('')
      }
    },
  },
  {
    dir: 'call-graph',
    title: '调用关系',
    desc: `在 ${SLUG} 仓库里看"谁调用了它 / 它调用了谁"，每条边都带置信度。Use to trace callers and callees with explicit confidence labels.`,
    when: '要判断改动会不会影响上游；或想顺着调用链理解一个流程。',
    body: (L) => {
      L.push('## 查询')
      L.push('')
      L.push('```bash')
      L.push(`PACK=<本技能包根目录>`)
      L.push(`Q="node $PACK/repo-index/bin/query.mjs"`)
      L.push('')
      L.push('$Q callers <名字> --index "$PACK/repo-index"   # 谁调用它')
      L.push('$Q callees <名字> --index "$PACK/repo-index"   # 它调用谁')
      L.push('```')
      L.push('')
      L.push('## 置信度是这一节的重点')
      L.push('')
      L.push('| 标记 | 含义 | 该怎么处理 |')
      L.push('|---|---|---|')
      L.push('| `high` | 调用方 import 了定义所在文件 | 基本可直接采信 |')
      L.push('| `medium` | 只匹配到名字 | **必须按类型确认**，同名会误判 |')
      L.push('| `[同名 N 处]` | 这个名字在仓库里有 N 个定义 | 先 `where`，再选对人 |')
      L.push('')
      L.push('`callees` 里的"未定义/外部"不一定是错的：可能是库里方法，也可能是同包类（Java 同包不需要 import）。')
      L.push('')
      L.push('## 已知看不见的情况')
      L.push('')
      L.push('- 反射 / `Class.forName` / Spring 容器按名字取 bean')
      L.push('- 通过消息队列、事件总线、定时任务触发的间接调用')
      L.push('- 配置里写死的类名、模板里写死的方法名')
      L.push('')
      L.push('这几种情况要回代码里找字符串常量，索引给不了答案。')
    },
  },
  {
    dir: 'impact-analysis',
    title: '影响面分析',
    desc: `改 ${SLUG} 仓库里的一个文件/符号之前，算出会波及哪些文件、哪些模块。按 import 边（high）与名字匹配（medium）分层给出。Use before changing a widely used file or a public method signature.`,
    when: '要改公共工具、基类、DTO、工具函数；或者不确定"这算不算大改"。',
    body: (L) => {
      L.push('## 查询')
      L.push('')
      L.push('```bash')
      L.push(`PACK=<本技能包根目录>`)
      L.push(`Q="node $PACK/repo-index/bin/query.mjs"`)
      L.push('')
      L.push('$Q impact <文件或符号> --depth 2 --index "$PACK/repo-index"')
      L.push('```')
      L.push('')
      L.push('## 怎么用这个结果')
      L.push('')
      L.push('1. **第 1 层 high 是你必须改/必须验的。** 这些文件直接 import 了目标，签名变了它们就编不过。')
      L.push('2. **第 2 层往后是"可能受影响"。** 用来排回归范围，不是用来决定改不改。')
      L.push('3. **medium 要打折看。** 名字匹配，可能是同名误判。抽样确认两三个再下结论。')
      L.push('4. 模块数超过 3 个时，**这已经不是小改动**，要拆批次或加兼容层。')
      L.push('')
      L.push('## 常见误读')
      L.push('')
      L.push('- "high 很少，所以安全" → 错。Java 同包引用不写 import，只会出现在 medium 里。')
      L.push('- "medium 很多，所以很危险" → 也可能只是 `get`/`init` 这种常见名字撞了。')
      L.push('- "索引没提到，所以没人用" → 反射、配置字符串、跨进程调用都看不见。')
      L.push('')
      L.push('## 本仓库的高风险点')
      L.push('')
      const fan = index.meta.topFanIn?.slice(0, 5) || []
      if (fan.length) {
        for (const f of fan) L.push(`- ${code(f.file)}（被 ${f.importedBy} 个文件导入）`)
        L.push('')
        L.push('```bash')
        L.push(`$Q impact "${fan[0].file}" --depth 1 --index "$PACK/repo-index"`)
        L.push('```')
        L.push('')
        L.push('改动前先跑这一条，把输出贴进改动说明里。')
      } else {
        L.push('_扫描时没有形成明显的中心文件。_')
        L.push('')
      }
    },
  },
  {
    dir: 'request-trace',
    title: '请求链路追踪',
    desc: `从 ${SLUG} 的 HTTP 端点出发，追到处理器、下游方法与被用到的模型。回答"这个接口最终落了哪张表"。Use to trace an endpoint end to end before debugging or changing it.`,
    when: '线上某个接口行为不对；或者要改接口但不知道下游牵了哪些模型。',
    body: (L) => {
      const eps = facts.httpEndpoints.filter((e) => e.scope === 'production')
      L.push('## 查询')
      L.push('')
      L.push('```bash')
      L.push(`PACK=<本技能包根目录>`)
      L.push(`Q="node $PACK/repo-index/bin/query.mjs"`)
      L.push('')
      L.push('$Q route <路径片段> --index "$PACK/repo-index"')
      L.push('```')
      L.push('')
      if (eps.length) {
        L.push('## 本仓库端点索引（按路径片段追）')
        L.push('')
        L.push(`共 ${eps.length} 个端点。完整目录见 \`../${SLUG}-dev-guide/references/03-api.md\`。抽样几条：`)
        L.push('')
        for (const e of eps.slice(0, 8)) L.push(`- \`${e.method} ${e.path}\` → ${e.handler}`)
        L.push('')
        L.push('```bash')
        L.push(`$Q route "${eps[0].path.split('/').filter(Boolean)[0] || ''}" --index "$PACK/repo-index"`)
        L.push('```')
        L.push('')
      } else {
        L.push('_这个仓库没有识别到 HTTP 端点。可能是库、CLI 或纯前端。_')
        L.push('')
      }
      L.push('## 追不动的时候')
      L.push('')
      L.push('1. `route` 说"未在索引里找到处理器" → 方法可能来自父类或接口默认实现，用 `where <方法名>` 找。')
      L.push('2. 下游是空 → 处理器只有一行委派，顺着 `callees` 再追一层。')
      L.push(`3. 表名对不上 → 模型可能是 \`PO\` 后缀，而表在 DDL 里；去 \`../${SLUG}-dev-guide/references/04-datamodel.md\` 对照。`)
      L.push('')
      L.push('## 边界')
      L.push('')
      L.push('`route` 给的是**静态可达**关系。拦截器、AOP、网关重写、MQ 消费都不在链路里，')
      L.push('所以"代码里没调"不等于"运行时不会走到"。')
    },
  },
  {
    dir: 'change-playbook',
    title: '改动施工单',
    desc: `要在 ${SLUG} 仓库里加一类东西（端点/字段/页面/定时任务）时的固定施工顺序，含该动哪些文件、哪些地方最容易漏。Use when adding a new endpoint, field, page or job and you need the full checklist.`,
    when: '明确要"加一个 X"，不想漏文件。',
    body: (L) => {
      const isFrontend = facts.languages.some((l) => (l.lang === 'vue' || l.lang === 'ts') && l.loc > facts.meta.totals.loc * 0.4)
      const isBackend = facts.languages.some((l) => l.lang === 'java' && l.loc > facts.meta.totals.loc * 0.3)
      L.push('## 施工单的用法')
      L.push('')
      L.push('下面每一套都是**顺序表**：从上往下做，不要跳。跳步才会漏。')
      L.push('')
      if (isBackend) {
        L.push('### 加一个 HTTP 端点（后端）')
        L.push('')
        L.push('| 步 | 动作 | 怎么确认没漏 |')
        L.push('|---|---|---|')
        L.push('| 1 | 定路径与请求/响应结构 | 路径前缀必须复用现有常量，不要新写字面量 |')
        L.push('| 2 | 加 Controller 方法 | `query.mjs route <前缀>` 能看到它 |')
        L.push('| 3 | 补 Service / 领域逻辑 | `query.mjs callees <Controller#方法>` 有下游 |')
        L.push('| 4 | 补权限/参数校验 | 现有 Controller 里同类方法都有，缺一个就是漏洞 |')
        L.push('| 5 | 补测试 | 该项目测试在 `src/test` 下，照同类写 |')
        L.push('| 6 | 更新接口文档 | 文档和代码同一提交 |')
        L.push('')
        const ctrl = facts.httpEndpoints.filter((e) => e.scope === 'production')[0]
        if (ctrl) {
          L.push('本仓库可参照的同类端点：')
          L.push('')
          L.push(`- \`${ctrl.method} ${ctrl.path}\` → \`${ctrl.file}:${ctrl.line}\``)
          L.push('')
        }
      }
      if (isFrontend) {
        L.push('### 加一个页面（前端）')
        L.push('')
        L.push('| 步 | 动作 | 怎么确认没漏 |')
        L.push('|---|---|---|')
        L.push('| 1 | 在 `views/` 下建页面 | 路由多为自动生成，改完确认路由表里有 |')
        L.push('| 2 | 加 i18n 键 | **所有语言包都要加**，只加 zh-cn 会在别的语言下显示 key 原文 |')
        L.push('| 3 | 补类型声明 | 手写的 `I18n.Schema` / `extra.d.ts` 不会自动生成 |')
        L.push('| 4 | 接 API | 走统一封装的请求层，不要在页面里裸 fetch |')
        L.push('| 5 | 覆盖三态 | 加载中 / 空 / 出错，三者都要有界面 |')
        L.push('| 6 | 跑 typecheck | 类型错误是最便宜的一关 |')
        L.push('')
        if (facts.uiRoutes.length) {
          L.push(`本仓库现有 ${facts.uiRoutes.length} 条路由，可参照 \`${facts.uiRoutes[0].file}\`。`)
          L.push('')
        }
      }
      L.push('### 加一个字段（跨层）')
      L.push('')
      L.push('顺序不能反——**先库，再实体，再 DTO，再接口，最后前端**。反了就会出现"前端传了但库里没列"。')
      L.push('')
      L.push('| 步 | 动作 |')
      L.push('|---|---|')
      L.push('| 1 | DDL 加列（`script/sql/` 下建版本文件），确认可空/默认值 |')
      L.push('| 2 | 实体/PO 加字段 |')
      L.push('| 3 | DTO/VO 加字段（请求与响应可能都要） |')
      L.push('| 4 | Service 映射（别漏 `BeanUtils.copyProperties` 之外的字段） |')
      L.push('| 5 | 前端类型 + 表单/表格列 |')
      L.push('| 6 | 所有语言包的文案 |')
      L.push('')
      L.push('### 加一个定时任务')
      L.push('')
      L.push('| 步 | 动作 | 注意 |')
      L.push('|---|---|')
      L.push('| 1 | 建任务类，加调度注解 | 多实例部署要加分布式锁，否则会重复执行 |')
      L.push('| 2 | 幂等设计 | 任务失败重试是常态，不能靠"只跑一次" |')
      L.push('| 3 | 可观测 | 至少要有开始/结束/耗时的日志 |')
      L.push('| 4 | 手动触发入口 | 出事时要能单独跑一次，不要只能等下一次 |')
      L.push('')
      L.push('## 施工完必须做的三件事')
      L.push('')
      L.push('1. **跑完整校验命令**（见 dev-guide 的 `00-overview.md`），把输出留下。')
      L.push('2. **跑一次影响面**：`query.mjs impact <你改的文件>`，确认没有意外的第 1 层。')
      L.push('3. **更新文档**：改动涉及的分册同步，别让手册和代码再分叉。')
      L.push('')
    },
  },
]

function querySkill(s) {
  const L = []
  L.push('---')
  L.push(`name: ${SLUG}-${s.dir}`)
  L.push(`description: "${s.desc.replace(/"/g, "'")}"`)
  L.push(`whenToUse: "${s.when.replace(/"/g, "'")}"`)
  L.push('---')
  L.push('')
  L.push(`# ${s.title} · ${SLUG}`)
  L.push('')
  L.push(PACK_HINT)
  L.push('')
  L.push(`**这个技能不是提示词，是能在你仓库上跑出结果的东西。** 索引在 \`repo-index/\`，`)
  L.push('查询器是真实代码；它答不出来就说答不出来，不会编。')
  L.push('')
  s.body(L)
  L.push('')
  L.push('## 索引重建')
  L.push('')
  L.push('代码改动大了就重建，否则答案会过期：')
  L.push('')
  L.push('```bash')
  L.push('node "$PACK/repo-index/bin/rebuild.sh"')
  L.push('```')
  L.push('')
  L.push('## 已知边界')
  L.push('')
  L.push(`- 抽取是 regex 级：${index.meta.coverage.languages.join(', ')} 之外的语法不保证。`)
  L.push('- 名字级结果一律标 `medium`，别当语法级事实用。')
  L.push('- 反射、动态导入、配置字符串、跨进程调用看不见。')
  L.push('')
  return L.join('\n')
}

// ------------------------------------------------------------------ 总装

emit(`skills/${SLUG}-dev-guide/SKILL.md`, devGuideSkill())
emit(`skills/${SLUG}-dev-guide/references/00-overview.md`, refOverview())
emit(`skills/${SLUG}-dev-guide/references/01-modules.md`, refModules())
emit(`skills/${SLUG}-dev-guide/references/02-entrypoints.md`, refEntrypoints())
emit(`skills/${SLUG}-dev-guide/references/03-api.md`, refApi())
emit(`skills/${SLUG}-dev-guide/references/04-datamodel.md`, refDataModel())
emit(`skills/${SLUG}-dev-guide/references/05-config.md`, refConfig())
emit(`skills/${SLUG}-dev-guide/references/06-conventions.md`, refConventions())
emit(`skills/${SLUG}-dev-guide/references/07-landmines.md`, refLandmines())
for (const m of facts.modules) {
  emit(`skills/${SLUG}-dev-guide/references/${moduleFiles.get(m.name)}`, refModule(m))
}

// 待补清单
{
  const L = []
  L.push(`# ${SLUG} · 待补清单`)
  L.push('')
  L.push('生成器只写它有证据的东西。下面这些条目**需要读代码才能写**，一条都还没写。')
  L.push('')
  L.push('规则：')
  L.push('')
  L.push('- 补完把对应的 `<!-- AGENT-TODO: 编号 ... -->` 整块替换成正文，不要只删标记。')
  L.push('- 写不出证据（`file:line`）的条目，就改成"未发现特有风险"并把标记删掉。')
  L.push('  **不要留占位句**——占位句会被后人当成已经核实过。')
  L.push('- 全部补完后跑 `verify-skillpack.mjs --strict`，它会检查有没有残留标记。')
  L.push('')
  L.push('| 编号 | 位置 | 要写什么 |')
  L.push('|---|---|---|')
  L.push('| E1 | `02-entrypoints.md` | 进程起来之后发生了什么（3-5 步，每步带路径） |')
  if (facts.httpEndpoints.some((e) => e.scope === 'production')) L.push('| A1 | `03-api.md` | 主流程端点的"路由 → 处理器 → 数据来源"链路 |')
  L.push('| D1/D2 | `04-datamodel.md` | 主键/审计字段策略、流水表清理策略 |')
  L.push('| C1 | `05-config.md` | 必填键、线上必须覆盖的键 |')
  L.push('| L1 | `07-landmines.md` | 只有读过代码才知道的坑（3-5 条，带证据） |')
  for (const m of facts.modules) {
    L.push(`| M-${slug(m.name)}-1..3 | \`${moduleFiles.get(m.name)}\` | 模块职责 / 典型流转 / 特有坑 |`)
  }
  L.push('')
  L.push(`合计 **${4 + facts.modules.length}** 组待补项。`)
  L.push('')
  emit(`skills/${SLUG}-dev-guide/AGENT-CHECKLIST.md`, L.join('\n'))
}

for (const s of QUERY_SKILLS) emit(`skills/${SLUG}-${s.dir}/SKILL.md`, querySkill(s))

// ------------------------------------------------------------------ 索引与工具

mkdirSync(indexDir, { recursive: true })
// 重跑时源和目标是同一个文件（--out 指向已有的 repo-index），直接 copy 会抛
const copyIfDiff = (src, dest) => { if (resolve(src) !== resolve(dest)) copyFileSync(src, dest) }
copyIfDiff(args.facts, join(indexDir, 'facts.json'))
copyIfDiff(args.index, join(indexDir, 'index.json'))

// 把查询器复制进包里，生成的技能才是自包含的（不依赖 repo-skill-forge 装在哪）
const here = dirname(fileURLToPath(import.meta.url))
const binDir = join(indexDir, 'bin')
mkdirSync(join(binDir, 'lib'), { recursive: true })
copyFileSync(join(here, 'query.mjs'), join(binDir, 'query.mjs'))
for (const f of readdirSync(join(here, 'lib'))) {
  const src = join(here, 'lib', f)
  if (statSync(src).isFile()) copyFileSync(src, join(binDir, 'lib', f))
}

// rebuild.sh：把重新扫描/重建/再生成串成一条命令，避免顺序记错
{
  const script = `#!/usr/bin/env bash
# 重建这个技能包的索引与手册。顺序不能换：facts → index → 渲染。
# 用法：bash repo-index/bin/rebuild.sh [仓库路径]
set -euo pipefail
REPO="\${1:-${REPO.replace(/\\/g, '/')}}"
PACK="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
FORGE="\${REPO_SKILL_FORGE:-${here.replace(/\\/g, '/')}}"

if [ ! -f "$FORGE/scan-repo.mjs" ]; then
  echo "找不到 repo-skill-forge：$FORGE" >&2
  echo "用 REPO_SKILL_FORGE=/path/to/repo-skill-forge/scripts 指定，或重新安装技能。" >&2
  exit 1
fi

node "$FORGE/scan-repo.mjs" "$REPO" --out "$PACK/repo-index" --name ${SLUG}
node "$FORGE/build-index.mjs" "$REPO" --out "$PACK/repo-index" --facts "$PACK/repo-index/facts.json"
node "$FORGE/emit-skills.mjs" --facts "$PACK/repo-index/facts.json" --index "$PACK/repo-index/index.json" --out "$PACK"

# 覆盖：emit 会重写 references，但 repo-index 是它自己的产物，这里把 bin 补回来
cp "$FORGE/query.mjs" "$PACK/repo-index/bin/query.mjs"
mkdir -p "$PACK/repo-index/bin/lib"
cp "$FORGE"/lib/*.mjs "$PACK/repo-index/bin/lib/"
echo "重建完成：$PACK"
`
  writeFileSync(join(binDir, 'rebuild.sh'), script, 'utf8')
  writeFileSync(join(binDir, 'query.cmd'), `@echo off\r\nnode "%~dp0query.mjs" %*\r\n`, 'utf8')
}

emit('repo-index/README.md', `# 索引与查询器

这份目录是自动生成的，不要手改。

| 文件 | 内容 |
|---|---|
| \`facts.json\` | 仓库事实（模块、命令、端点、实体、配置键、热点、技术债） |
| \`index.json\` | 符号索引（定义、导入边、引用计数） |
| \`bin/query.mjs\` | 查询 CLI，6 个技能共用 |
| \`bin/rebuild.sh\` | 重扫 + 重建 + 重新生成 |

## 常用命令

\`\`\`bash
Q="node $(pwd)/repo-index/bin/query.mjs"
$Q stats --index repo-index
$Q where <名字> --index repo-index
$Q impact <文件> --depth 2 --index repo-index
\`\`\`

## 精度

- 定义与导入：语法级（high）
- "谁引用了它"：名字级（medium），同名会误判
- 看不见：反射、动态导入、配置里写死的类名、跨进程调用
`)

emit('README.md', `# ${SLUG} 技能包

由 **repo-skill-forge** 生成（${STAMP}，HEAD \`${HEAD}\`）。装到 DSH / Codex 后，agent 会得到：

| 技能 | 干什么 |
|---|---|
| \`${SLUG}-dev-guide\` | 阅读这个仓库：模块、入口、接口、模型、配置、地雷 |
| \`${SLUG}-repo-map\` | 定位东西在哪 |
| \`${SLUG}-symbol-lookup\` | 找符号定义与引用 |
| \`${SLUG}-call-graph\` | 谁调谁（带置信度） |
| \`${SLUG}-impact-analysis\` | 改之前算影响面 |
| \`${SLUG}-request-trace\` | 端点追到表 |
| \`${SLUG}-change-playbook\` | 加接口/字段/页面/任务的施工顺序 |

## 安装

把 \`skills/\` 下的目录复制（或链接）到你的技能目录：

\`\`\`bash
# DSH / Codex 用户级
cp -r skills/* ~/.workbuddy/skills/
\`\`\`

索引在 \`repo-index/\`，技能通过相对路径找它。**移动目录后**要用 \`--index\` 显式指定。

## 重建

\`\`\`bash
bash repo-index/bin/rebuild.sh /path/to/repo
\`\`\`

## 先补再发

\`skills/${SLUG}-dev-guide/AGENT-CHECKLIST.md\` 里列着 ${4 + facts.modules.length} 组待补项。
**没补完就发布，等于把一份半成品手册发给同事。** 校验：

\`\`\`bash
node <repo-skill-forge>/scripts/verify-skillpack.mjs . --strict
\`\`\`
`)

const total = written.reduce((a, w) => a + w.lines, 0)
if (!args.quiet) {
  console.log(JSON.stringify({
    ok: true,
    out: args.out,
    skills: 1 + QUERY_SKILLS.length,
    files: written.length,
    lines: total,
    todos: 4 + facts.modules.length,
    devGuideLines: written.filter((w) => w.rel.includes('dev-guide')).reduce((a, w) => a + w.lines, 0),
  }, null, 2))
  for (const w of written.sort((a, b) => b.lines - a.lines).slice(0, 8)) console.log(`  ${String(w.lines).padStart(5)} 行  ${w.rel}`)
}
