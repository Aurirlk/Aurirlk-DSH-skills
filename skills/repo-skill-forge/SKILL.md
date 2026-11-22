---
name: repo-skill-forge
description: "把陌生仓库锻造成一套能用的技能：扫描事实 → 建符号索引 → 生成 1 本开发手册（dev-guide，分册 + 每模块一册）和 6 个查询技能（地图/符号定位/调用关系/影响面/请求链路/改动施工单），最后强制校验（引用路径必须存在、模块必须全覆盖、TODO 必须清零）。Turn any repository into an agent-usable skill pack: fact scan, symbol index, generated dev-guide plus six query skills, then a verification gate. Triggers: 「给这个仓库生成文档」「接手一个陌生项目」「让 agent 认识这个代码库」「dev-guide」「代码地图」「onboard 新同事」。"
whenToUse: "用户第一次接触一个仓库、要接手或交接、仓库文档已过时、需要让 AI agent 在没有人工讲解的情况下定位代码与判断影响面。Also when onboarding onto an unfamiliar codebase, writing a codebase guide, or when existing docs no longer match the code."
---

> Language note: this instruction body is written in Chinese. The frontmatter `description` above is
> bilingual so the skill is discoverable in both languages. An English body is welcome as a
> contribution — see [CONTRIBUTING.md](../../CONTRIBUTING.md).

# 仓库技能锻造器

把一个仓库变成 **7 个技能**：1 本开发手册 + 6 个查询技能。全部带索引、带出处、带校验。

## 先说清楚界限：哪些机器做，哪写必须人做

这是这个技能和"让大模型写一份项目介绍"的根本区别。

| 内容 | 谁做 | 为什么 |
|---|---|---|
| 模块清单、文件数、行数、依赖 | 脚本 | 数得出来，而且必须数对 |
| 构建/测试/检查命令 | 脚本（带出处） | 从 `package.json` / `pom.xml` / `go.mod` 里读，不猜 |
| HTTP 端点、前端路由 | 脚本 | 注解与路由表是语法事实 |
| 实体 ↔ 表名 | 脚本（标注推断） | 注解优先，没有就按命名规则推，并标明"推断" |
| 配置键 | 脚本（**只收键名**） | 值里有密码、token、内网地址，落盘就是事故 |
| 热点文件、被依赖最多的文件 | 脚本 | 统计 + 索引扇入 |
| 技术债计数（TODO/FIXME/any/console） | 脚本 | 数得出来 |
| **模块职责、关键流程、特有坑** | **agent 读代码后写** | 脚本猜出来的"职责"一定错，而错的手册比没手册更坏 |

所以生成物里会留 `<!-- AGENT-TODO: 编号 ... -->`。**这些标记没补完、没跑过 `--strict`，就不算交付。**

## 什么时候用

- 「我接手了这个仓库，从哪看起？」
- 「给这个项目写一份能给人和 agent 看的文档」
- 「现有文档和代码对不上了」
- 「让它能回答：改这个类会炸哪些地方？」
- 交接给新同事 / 新 agent / 新会话（上下文一断，知识就归零）

**不适合**：单文件脚本、没有源码的仓库、只想看 README 的场景。少于 30 个源码文件的仓库，直接读比生成便宜。

## 一条命令跑完（推荐）

```bash
node "$SKILL/scripts/forge.mjs" "$REPO" --out "$OUT" --name my-repo
```

内部就是下面四步，顺序固定、失败即停。`verify` 失败时退出码是 1（意思是"内容还没补完"，
不是工具坏了），其余步失败是 2（流水线中止）。加 `--strict` 则 TODO 必须清零才算通过。

不加 `--out` 时默认写到**当前目录**的 `<仓库名>-skills` —— 刻意不写进仓库内部，
避免往别人的仓库里塞一个未跟踪目录、被误提交。

## 四步拆开跑（要单独调某一步时）

```bash
SKILL=<repo-skill-forge 技能目录>       # 含 scripts/ 与 references/
REPO=<目标仓库>
OUT=<输出包目录>                        # 建议 <REPO>/.skills-pack 或独立目录

# ① 事实扫描：模块、命令、端点、实体、配置键、热点、技术债
node "$SKILL/scripts/scan-repo.mjs" "$REPO" --out "$OUT/repo-index" --name my-repo

# ② 符号索引：定义、导入边、引用计数
node "$SKILL/scripts/build-index.mjs" "$REPO" --out "$OUT/repo-index" \
  --facts "$OUT/repo-index/facts.json"

# ③ 生成技能：1 本手册 + 6 个查询技能 + 自带查询器
node "$SKILL/scripts/emit-skills.mjs" \
  --facts "$OUT/repo-index/facts.json" \
  --index "$OUT/repo-index/index.json" \
  --out "$OUT"

# ④ 校验（第一次跑会告诉你还剩多少 TODO）
node "$SKILL/scripts/verify-skillpack.mjs" "$OUT"
```

① 和 ② 都是纯读。③ 只写 `$OUT`。**只要 `$OUT` 不在仓库内部，全程就不动目标仓库的任何文件。**

实测规模参考：1,400 个源码文件的后端仓，① 约 1.8 秒、② 约 1.4 秒、③ 约 0.2 秒。

## 输出长什么样

```
$OUT/
├── repo-index/              # 索引与查询器（自动生成，不要手改）
│   ├── facts.json           # 仓库事实
│   ├── FACTS.md             # 事实摘要（核对扫描准不准就看这份）
│   ├── index.json           # 符号索引
│   └── bin/query.mjs        # 查询 CLI（复制进来的，技能自包含）
└── skills/
    ├── <repo>-dev-guide/              # 开发手册
    │   ├── SKILL.md                   # 入口：怎么读、按任务路由
    │   ├── AGENT-CHECKLIST.md         # 待补清单（编号 → 位置 → 要写什么）
    │   └── references/
    │       ├── 00-overview.md         # 规模、语言、技术栈、命令（带出处）
    │       ├── 01-modules.md          # 模块表 + 跨模块 import 实际流向
    │       ├── 02-entrypoints.md      # 入口与第一跳
    │       ├── 03-api.md              # 端点与前端路由，按模块分组
    │       ├── 04-datamodel.md        # 实体 ↔ 表
    │       ├── 05-config.md           # 配置键（无值）+ 敏感键清单
    │       ├── 06-conventions.md      # 命名分布、工具链、技术债
    │       ├── 07-landmines.md        # 最大文件、扇入最高文件、无测试模块
    │       └── 10-module-<名字>.md    # 每模块一册：目录、文件清单、符号、端点
    ├── <repo>-repo-map/               # 东西在哪
    ├── <repo>-symbol-lookup/          # 定义与引用
    ├── <repo>-call-graph/             # 谁调谁（带置信度）
    ├── <repo>-impact-analysis/        # 改它会波及什么
    ├── <repo>-request-trace/          # 端点 → 处理器 → 表
    └── <repo>-change-playbook/        # 加接口/字段/页面/任务的施工顺序
```

行数是**把要查的东西铺开**换来的，不是灌水：每个模块的文件清单一行、每个端点一行、每个实体一行、每个配置键一行。一个 1,400 文件的仓库能到 3,000 行左右；一个 360 文件的前端仓约 1,300 行。

## 六个查询技能背后是同一份索引

它们不是六段提示词，是同一个 `query.mjs` 的六种用法：

```bash
Q="node $OUT/repo-index/bin/query.mjs"

$Q mods    # 模块、跨模块依赖
$Q where <名字>          # 定义在哪
$Q refs <名字>           # 谁提到过它（带行号）
$Q callers <名字>        # 谁调用它（high/medium）
$Q callees <名字>        # 它调用谁
$Q impact <文件|符号> --depth 2
$Q route <路径片段>      # 端点 → 处理器 → 下游 → 模型
$Q deps <文件>           # 导入 / 被导入
$Q stats                 # 规模、扇入、热点
$Q files <片段>          # 按路径找
```

加 `--json` 拿结构化结果做后续处理。

**共用一份索引的理由**：六个技能各建一套，同一个名字在不同技能里会给出不同答案，用户不知道该信哪个。

## 铁律

1. **先扫后写。** 任何"这个模块负责 X"的句子，必须先跑过扫描、看过真实文件。凭仓库名和目录名想象职责，是这个流程里最容易犯、最贵的错。
2. **每条判断都要落到 `file:line`。** 写不出出处的句子，删掉比留着好——它会让下一个人以为这里被核实过。
3. **TODO 只有两个合法结局**：补上有证据的内容，或改成"未发现特有风险"并把标记删掉。**不许留占位句。**
4. **配置只写键名。** 扫描器已经在做，人工补的时候也不许贴值。要真实值指向部署环境。
5. **手册是介绍，不是复盘。** 不写"某次发布失败是因为…"，那是事故记录的位置。手册只回答"现在是什么样、要改该动哪"。
6. **表和推断要分开标。** `@TableName` 读出来的表名是事实，按类名转下划线是推断——推断的必须标出来，否则上线才发现对不上。
7. **`verify` 不过不交付。** 它检查的是"引用的文件是否存在"这种硬事实，没有主观空间。

## 补 TODO 的正确姿势

每条 TODO 都是一个具体的写作任务，不是"请补充说明"。做法：

1. 按 TODO 里给的路径打开 2-4 个文件（用 `query.mjs files <目录>` 或 `where` 定位）。
2. 只写你看到的：入口函数、调用顺序、状态变化、失败处理。
3. 每句结论后面跟 `path:line`。
4. 把整块 `<!-- AGENT-TODO: ... -->` 换成正文，不要只删标记。
5. 跑 `verify-skillpack.mjs --strict`，清零才算完。

**反例（这样写等于没写）**：

- 「本模块负责核心业务逻辑」→ 哪个逻辑？谁调它？边界在哪？
- 「遵循分层架构，Controller 调 Service」→ 全天下都这么说。
- 「注意并发问题」→ 哪个共享状态？在哪一行？

**正例**：

- 「`AgentController.create`（`.../AgentController.java:216`）只做参数校验，实际落库在 `AgentService#create`（`:88`），后者用 `@Transactional` 包住写 `agent` 与 `agent_app` 两张表，任一失败整体回滚。」

详见 [`references/writing-todos.md`](references/writing-todos.md)。

## 校验器到底查什么

```bash
node "$SKILL/scripts/verify-skillpack.mjs" "$OUT"           # 日常
node "$SKILL/scripts/verify-skillpack.mjs" "$OUT" --strict   # 交付前（TODO 必须清零）
```

| 检查 | 判据 | 为什么 |
|---|---|---|
| 结构 | 每个技能有 SKILL.md、frontmatter、`# 标题` | 缺了在技能目录里等于"看不见" |
| 路径 | 文档里每个反引号包住的路径在仓库里真实存在 | 生成的手册最容易在这里骗人 |
| 覆盖 | 每个模块都有模块册、都在模块总表里 | 漏一个模块，那部分就等于没写 |
| 端点 | 每个端点的来源文件存在 | 端点表是扫描产物，不该错 |
| TODO | `--strict` 下必须为 0 | 半成品不能发布 |
| 索引 | `index.json` 非空、`meta.root` 存在、不与磁盘脱节 | 索引过期会让所有查询答错 |
| 可移植 | 文档里不出现绝对路径 | 换个机器就断链 |

## 已知边界（必须主动告诉用户）

- **抽取是 regex 级，不是编译器级。** 定义与导入可靠（`high`）；"谁调用了它"是名字匹配（`medium`），同名会误判。重载、泛型特化、动态导入一律失真。
- **看得见的语言**：Java / Kotlin / TypeScript / JavaScript / Vue / Svelte / Python / Go。其它语言只做文件级统计（行数、目录、大小），不产符号——`references/extraction-limits.md` 有逐语言说明。
- **看不见的东西**：反射、Spring 按 bean 名取实例、消息队列消费、配置里写死的类名、模板里拼出来的方法名、跨进程调用。这些只能在正文里写明"需人工确认"。
- **Java 同包引用不写 import**，所以只在 `medium` 里出现。这不是漏，是语言特性，别当成 bug 修。
- **端点路径依赖常量解析。** 常量嵌套两层以上、或来自依赖包（不在仓库里）时会解析失败，产物里保留 `<NAME>` 并标 `resolved:false`。**这种路径不能当契约用。**
- **文档会过期。** 代码一改手册就开始偏。索引可以随时重建，手册要重扫重生成；补过 TODO 的内容会丢，所以补完的正文建议单独存一份或在 PR 里保留。

## 交付前清单

- [ ] `verify-skillpack.mjs --strict` 通过（0 错误、0 TODO）
- [ ] 随便挑 5 条手册里的结论，逐个回代码核对（尤其是带数字和表名的）
- [ ] 确认产物里没有任何配置值、密码、内网地址（`grep -riE "password|secret|token=" $OUT/skills`）
- [ ] 确认没有绝对路径（校验器会报，但自己再看一眼）
- [ ] 把 `repo-index/bin/rebuild.sh` 跑一遍，确认重建链路通
- [ ] 告诉用户：索引多大、手册多少行、还剩哪些边界

## 参考

- [`references/output-shape.md`](references/output-shape.md) — 每个分册该有什么、为什么这么切
- [`references/extraction-limits.md`](references/extraction-limits.md) — 逐语言的抽取能力与失真点
- [`references/writing-todos.md`](references/writing-todos.md) — 怎么把 TODO 写成有用的内容（正反例）
