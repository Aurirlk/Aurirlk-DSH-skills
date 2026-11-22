# repo-skill-forge

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

把一个陌生仓库锻造成一套能用的技能：**1 本开发手册 + 6 个查询技能**，全部带索引、带出处、带校验。

## 这玩意儿治什么

接手一个几万行的仓库，头三天基本在干三件事：找文件、猜职责、问人。这三件事都不产出代码，
而且换个人重来一遍。

大模型能帮你读代码，但它读完就忘——下一个会话又要从头讲一遍。真正该留下的不是"某次对话里的理解"，
是**一份能查、能验、能重建的地图**。

这个技能做的就是这件事。但它有一条明确的边界：

> **机器只交付事实，判断必须由读过代码的人写。**

因为脚本猜出来的"这个模块负责 X"一定错，而一份写着错职责的手册，会让每一个后来的人先被误导一遍。

## 产出长什么样

```
OUT/
├── repo-index/                    # 索引 + 查询器（自动）
│   ├── facts.json                 # 模块/命令/端点/实体/配置键/热点/技术债
│   ├── FACTS.md                   # 事实摘要（核对扫描准不准就看这份）
│   ├── index.json                 # 符号索引（定义/导入边/引用）
│   └── bin/query.mjs              # 查询 CLI，6 个技能共用
└── skills/
    ├── <repo>-dev-guide/          # 开发手册
    │   ├── SKILL.md               # 入口：按任务类型路由
    │   ├── AGENT-CHECKLIST.md     # 待补清单（编号 → 位置 → 要写什么）
    │   └── references/
    │       ├── 00-overview.md     # 规模、语言、技术栈、命令（带出处）
    │       ├── 01-modules.md      # 模块表 + 跨模块 import 实际流向
    │       ├── 02-entrypoints.md  # 入口与第一跳
    │       ├── 03-api.md          # 端点与路由，按模块分组
    │       ├── 04-datamodel.md    # 实体 ↔ 表（区分事实与推断）
    │       ├── 05-config.md       # 配置键（无值）+ 敏感键
    │       ├── 06-conventions.md  # 命名分布、工具链、技术债
    │       ├── 07-landmines.md    # 最大文件、扇入最高、无测试模块
    │       └── 10-module-*.md     # 每模块一册：目录角色、文件清单、符号、端点
    ├── <repo>-repo-map/           # 东西在哪
    ├── <repo>-symbol-lookup/      # 定义与引用
    ├── <repo>-call-graph/         # 谁调谁（带置信度）
    ├── <repo>-impact-analysis/    # 改它会波及什么
    ├── <repo>-request-trace/      # 端点 → 处理器 → 表
    └── <repo>-change-playbook/    # 加接口/字段/页面/任务的施工顺序
```

**行数是铺开换来的，不是灌水**：每个模块的文件清单一行、每个端点一行、每张表一行、每个配置键一行。
实测 1,400 个源码文件的后端仓约 3,200 行手册；360 个文件的前端仓约 1,300 行。

## 怎么跑

```bash
SKILL=<本技能目录>
REPO=<目标仓库>
OUT=<输出包目录>

# 一条命令（推荐）：扫 → 索引 → 生成 → 校验
node "$SKILL/scripts/forge.mjs" "$REPO" --out "$OUT" --name my-repo

# 或者四步拆开，方便单独调某一步
node "$SKILL/scripts/scan-repo.mjs"  "$REPO" --out "$OUT/repo-index" --name my-repo
node "$SKILL/scripts/build-index.mjs" "$REPO" --out "$OUT/repo-index" --facts "$OUT/repo-index/facts.json"
node "$SKILL/scripts/emit-skills.mjs" --facts "$OUT/repo-index/facts.json" \
                                      --index "$OUT/repo-index/index.json" --out "$OUT"
node "$SKILL/scripts/verify-skillpack.mjs" "$OUT"
```

三步都是纯读，不改目标仓库。实测 1,400 文件的后端仓：扫描 1.8s、建索引 1.4s、生成 0.2s。

生成物自带 `repo-index/bin/rebuild.sh`，以后一条命令重建：

```bash
bash "$OUT/repo-index/bin/rebuild.sh"        # 路径已记在索引里
```

## 三个设计决定，以及为什么

### 1. 六个技能共用一份索引

各建一套的话，同一个名字在不同技能里给出不同答案，用户不知道该信哪个。
现在六个技能的差别只是"怎么问"，答案来自同一份 `index.json`。

查询器是真的代码，不是提示词：

```bash
Q="node $OUT/repo-index/bin/query.mjs"
$Q where AgentController#create     # 定义在哪
$Q callers create                   # 谁调用它（high/medium）
$Q impact src/.../Result.java       # 改它波及什么
$Q route /api/agent                 # 端点追到表
$Q stats                            # 扇入最高的文件
```

### 2. 置信度必须写在结果里

| 边 | 置信度 | 依据 |
|---|---|---|
| import / 组件使用 | `high` | 语法结构 |
| "谁引用了这个名字" | `medium` | 名字匹配，同名会撞 |

`medium` 只能当线索。手册里凡引用 medium 的推断，都写"需按类型确认"。
把两种边混在一起说，等于把猜测打扮成事实。

### 3. 判断留成编号 TODO，而不是让脚本编

`AGENT-CHECKLIST.md` 里列着 `M-<模块>-1..3` 这样的编号，每个对应一处必须读代码才能写的内容。
补完把整块标记换成正文；写不出证据就写"未发现特有风险"并删标记——**不许留占位句**。

`verify-skillpack.mjs --strict` 会数：残留标记不为 0 就是没交付。

## 校验器查什么

| 检查 | 判据 |
|---|---|
| 结构 | 每个技能有 SKILL.md、frontmatter、一级标题 |
| **路径** | 文档里每个反引号包住的路径，在仓库里真实存在 |
| 覆盖 | 每个模块都有模块册、都在模块总表里 |
| 端点 | 每个端点的来源文件存在 |
| TODO | `--strict` 下必须为 0 |
| 索引 | 非空、`meta.root` 存在、不与磁盘脱节 |
| 可移植 | 文档里不出现绝对路径 |

第二条是核心：**一份引用了 20 个不存在文件的"开发手册"，比没有手册更容易骗人。**

## 它能自动搞清楚什么

| 事实 | 怎么来的 |
|---|---|
| 模块与规模 | 读 `pom.xml` / `package.json` workspaces / `settings.gradle` / `go.mod` |
| 构建与验证命令 | 从配置里读，标注 `declared`（读到的）或 `convention`（按生态惯例推的） |
| HTTP 端点 | 注解解析，**含两层常量解析**（`@RequestMapping(PATH_CONST)` 也能还原） |
| 前端路由 | 路由表里的 `path` / `name` |
| 实体 ↔ 表 | `@TableName` / `@Table` 优先，否则按命名规则推并标"推断" |
| 配置键 | `.env` / `application*.yml` / `@Value` / `import.meta.env`，**只收键名** |
| 热点与风险 | 文件行数、扇入次数、无测试模块 |
| 技术债 | `TODO`/`FIXME`/`HACK` 计数与位置、`any`、`console.log` |

## 它明确做不到什么

- **抽取是 regex 级**：重载、泛型特化、动态导入会失真；"谁调用它"是名字匹配。
- **只覆盖** Java / Kotlin / TS / JS / Vue / Svelte / Python / Go 的符号；其它语言只给文件级统计。
- **看不见**：反射、Spring 按 bean 名取实例、消息队列消费、配置里写死的类名、代码生成的类。
- **Java 同包引用不写 import**，所以只出现在 `medium` 里——这是语言特性，不是漏。
- **常量来自依赖包**时端点路径解析不出来，产物里保留 `<NAME>` 并标 `resolved:false`，这类不能当契约用。

这些不是免责声明，是"手册可能在哪些地方错"的预告。逐语言的细节见
[`references/extraction-limits.md`](references/extraction-limits.md)。

## 生成的手册会过期

代码一改，手册就开始偏。所以：

- 索引随时可重建（`rebuild.sh`），重建后查询立刻准确。
- 手册要重扫重生成；**补过的 TODO 正文会丢**，建议在 PR 里保留那些补充内容，或者把手册纳入版本控制。
- 手册和索引冲突时，以索引为准。

## 相关

- [`references/output-shape.md`](references/output-shape.md) — 每册治什么病、容易写坏在哪
- [`references/extraction-limits.md`](references/extraction-limits.md) — 逐语言能力与失真点
- [`references/writing-todos.md`](references/writing-todos.md) — 把 TODO 写成有用内容（正反例）

配套技能：用 [docs-code-sync](../docs-code-sync/README.md) 管"改代码必须改文档"，
用 [no-stub-delivery](../no-stub-delivery/README.md) 审"这功能是不是真的接上了"。
