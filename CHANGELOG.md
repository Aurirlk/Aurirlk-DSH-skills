# 更新日志

本文件记录本仓库的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **仓库形态**：本仓库是 **Aurirlk 的 DSH 技能合集**，不是单个技能。
> 每个技能一个顶层目录（`skills/<名字>/`），共用仓库级校验与一套 npm 打包。
> 下面的版本号针对**整个合集包**。

## [0.3.1] - 2026-10-06

drawio 技能的体检脚本升级：**采纳显式拐点**，让「改走线 → 复验」真正成立。

### 修复

- **体检原先完全忽略 `<Array as="points">` 拐点。** 它按「下出 → 中间横移 → 上进」
  近似 draw.io 的正交路由，于是**用手工拐点修好穿框之后，体检仍会报同样的 3 处**——
  工具没法验证自己给出的修复建议。现在：边带拐点时走真实折线
  （出口锚点 → 拐点 → 入口锚点，锚点读 style 的 `exitX/exitY/entryX/entryY`），
  只有**没有**拐点的边才退回近似。
- 线段与矩形的相交判定从「仅轴对齐」换成通用的 **Liang-Barsky 裁剪**——
  有了拐点之后，锚点到第一个拐点那一段未必是正交的。

### 新增

- 自检加一条回归锁：构造「障碍方框夹在源与目标之间」的几何，要求
  **无拐点版报 1 处、加绕行拐点版报 0 处**，防止「拐点被忽略」悄悄复发。
- `references/03-布局体检.md` 补「实战案例：三条边绕过中间件层」，含那个绕不开的约束
  （Kafka 完全覆盖 MySQL 的水平范围，唯一可用竖直通道是 Kafka 与 Redis 之间的
  `x ∈ (680, 710)`），以及为什么线段互穿不该当成问题。

### 说明

- 该案例来自一份真实的两页架构图：修前三处穿框，修后 0 处。

## [0.3.0] - 2026-10-06

新增第 9 个技能 **drawio**（原创）——生成、导出与体检 draw.io 图表。

### 新增 —— 文档与图表

- **drawio**：三条线（生成 / 导出 / 体检），三个脚本
  - `New-Drawio.ps1`：从 JSON 规格生成 `.drawio`，**分层自动布局**——只写结构不写坐标，
    横向位置由层内等分算出，从数学上排除方框重叠与越出容器
  - `Export-Drawio.ps1`：逐页导出 PNG / SVG / PDF，自动探测 draw.io 安装位置
  - `Test-DrawioLayout.ps1`：布局体检，查四类缺陷（方框重叠 / 越出容器 / 连线穿框 / 文字溢出），
    只读，退出码可用于 CI
  - 4 篇 references + 1 个示例规格（4 层 15 模块）

### 实测 —— 三个 draw.io CLI 陷阱（已固化进脚本与文档）

- **`--page-index` 是 1-based，传 `0` 不报错、静默回落到第 1 页。**
  实测同一文件：`0` 与 `1` 产出字节完全相同（330,806），只有 `2` 才拿到第二页（375,304）。
  「习惯性从 0 开始循环」会安静地导出 N 份第 1 页，退出码永远是 0。
  导出脚本因此内置**产物哈希核对**：两页字节相同即告警。
- **`--all-pages` 在 30.2.4 的 PNG 导出上无效**，只出第 1 页；多页必须自己循环
  `--page-index`。（`--format svg` 是例外，支持多页合一。）
- **CLI 是 Electron 进程，退出不等于文件写完。** 连续调用时第二次会被第一次没退干净的
  实例吞掉，产出上一页的内容。必须 `Start-Process -Wait` 之后再轮询文件、并等大小稳定。

### 修复 —— PowerShell 5.1 的两个坑（脚本内已加注释防复发）

- **`@()` 包 `List[object]` 抛「参数类型不匹配」**（连空 List 都炸），必须用 `.ToArray()`。
  注意只有 `@()` 直接包 List 变量会炸；`@($var | Where-Object {...})` 是安全的。
- **函数返回 `List` 时会被拆成裸对象**：单元素情况下调用方拿到的是 `PSCustomObject`，
  它的 `.Count` 是**空**，于是 `1..$pageCount` 退化成 `1..$null` = `1,0`（降序两元素），
  报出莫名其妙的「页号超出范围：1,0」。**单页文件必踩、多页文件完全不踩**，
  调用方必须写 `@(函数调用)`。本技能开发过程中就栽在这条上。

### 说明

- draw.io 桌面版**不是必需**：生成与体检都是纯 XML 操作，只有导出需要 CLI。
- 探测 draw.io 安装位置**不能依赖注册表 `InstallLocation`**（实测为空），
  要读 `DisplayIcon` 并剥掉末尾的 `,\d+` 图标索引。
- 体检的「文字溢出」是估算（CJK = 1.0×fontSize、ASCII = 0.55×fontSize），
  「连线穿框」按 draw.io 正交路由近似；两条局限都写进了技能 README。

## [0.2.0] - 2026-10-06

仓库定位调整为**通用 DSH 技能分享仓库**，新增 7 个技能（合计 8 个）。

### 新增 —— 前端开发

- **code-review-refactor**：Nuxt 4 + Vue 3 + Vuetify 3 的可落地代码审查与重构
- **git-commit-message-generator**：约定式提交信息生成
- **ui-tip**：全局 Toast 调用规范（错误必须显式指定 icon）
- **ui-use-confirm**：确认弹窗规范与二次确认判据
- **vuetify0**：`@vuetify/v0` 无样式组件与 composable 指南（含 6 个 references）

### 新增 —— 求职 / 面试

- **create-interviewer**：把面试官蒸馏成持续进化的 AI 角色
- **interview-skills**：大厂 AI 模拟面试官（含 7 个 references）

### 新增 —— 合规

- **`ATTRIBUTIONS.md`**：逐个记录二开来源、许可证、改动内容。用于履行
  Apache-2.0（保留声明 + 标明改动）与 MIT（保留版权声明）的署名义务。

### 变更

- 根 README 重新定位为通用分享仓库，技能目录按「系统工具 / 前端开发 / 求职面试」分区
- 新增「相关项目」区块，推荐 **ASu-skills** 与 **@vuetify/v0**（不复制其内容）
- 所有 8 个技能补齐**中英双语 README**
- `index.js` 无需改动——它本来就遍历 `skills/` 注册，新增技能自动生效

### 说明

- 二开技能的改动一律限于**适配层**（frontmatter 规范化、目录重命名、补写 README），
  例外是 `ui-tip` / `ui-use-confirm`——原文假定项目内已存在 `$tip` / `useConfirm`，
  为使其独立可用补上了最小实现，已在 ATTRIBUTIONS 中显式标明
- `vuetify0` 改用**官方完整版**（18.4 KB + 6 references），而非 DataAgent 里那份
  3.9 KB 且丢失全部 references 的删减版
## [未发布]

### 计划中

- 各技能 `SKILL.md` **正文**的英文版（当前正文为中文；frontmatter 与 README 已双语）

- 空间趋势的图形化导出（当前是 Unicode 迷你趋势图）
- 管理员级清理的脚本化（卷影副本、`hiberfil.sys`——实测单机有约 11 GB 属这类）

## [0.1.0] - 2026-10-05

首个版本。仓库定位为**技能合集**：`index.js` 遍历 `skills/` 注册全部技能，
新增技能无需改代码；CI 同样遍历所有技能做校验。

### 新增 —— 合集骨架

- `index.js`：遍历 `skills/<名字>/SKILL.md` 并逐个注册技能。导出 `discoverSkills()`
  供测试与工具使用；每个技能各用一个 `ctx.effect`，卸载插件可干净撤掉全部技能。
- `scripts/self-test.mjs`：合集注册逻辑 + frontmatter 解析器的单元测试。
- `scripts/Fix-Bom.ps1`：仓库级 BOM 校正（`.ps1` 必须有、`SKILL.md` 必须没有）。
- `.github/workflows/verify.yml`：**遍历所有技能**跑自检，并验证合集注册逻辑。
- `CONTRIBUTING.md` 里的「新增一个技能」四步流程。

### 新增 —— 文档（中英双语）

- 根目录 `README.md` / `README.en.md`：仓库介绍 + 技能目录，顶部互相跳转
- 技能级 `README.md` / `README.en.md`：介绍、用法、安装方式、安全模型
- `SKILL.md` 的 `description` 与 `whenToUse` 改为**双语**——它是技能目录里唯一被模型
  看到的一行，双语让中英文提问都能命中。正文仍为中文，英文正文欢迎贡献。

### 新增 —— 技能：disk-butler

- `Find-Junk.ps1`：扫描 10 类可清理目标，按 `Safe` / `Confirm` / `Report` 三档产出 JSON 计划。
  覆盖系统临时文件、崩溃转储、包管理器缓存、浏览器缓存、`~/.cache/<工具>`、
  系统更新残留、回收站、大文件、项目构建缓存，以及 **Agent 运行脚本残余**
  （`_npx` 缓存、`%TEMP%\dsh-*`、工具 `.tmp`）。
  实测单机识别出约 7.4 GB。
- `Get-Drilldown.ps1`：逐层下钻回答「这个目录里到底是什么」。
  单次遍历 + 自底向上汇总，复杂度 O(数据量) 而不是 O(数据量 × 层数)。
- `Get-Trend.ps1`：读全部历史快照，给出各盘可用空间的逐次变化、Unicode 迷你趋势图、
  以及「什么在长大 / 变小」的涨跌榜。

### 新增 —— 操作（有副作用）

- `Invoke-Cleanup.ps1`：执行清理计划。**默认预演**，必须显式 `-Execute`。
  执行时对每一项重新校验安全规则（双层校验）。
- `Invoke-Cleanup.ps1 -Quarantine`：安全隔离模式。把目标移进**同盘**隔离区
  （同卷改名，瞬间完成），可 `-ListQuarantine` / `-RestoreQuarantine` / `-PurgeQuarantine`。
  **隔离不等于释放空间**——空间要等 purge 才回来。
- `Move-Cache.ps1`：用 NTFS Junction 把写死在 C 盘的缓存目录透明迁移到其他盘。
  流程为「复制 → 校验文件数与字节数一致 → 才删源 → 建链接 → 校验可读」，
  任何一步失败都中止且不动源目录。带回退记录。
- `Update-Wiki.ps1`：生成/刷新本机档案。`auto\`（脚本生成，整体覆盖）与
  `kb\`（人工知识，脚本不碰）严格分离。

### 新增 —— 分发形态

同一份技能真源（`skills/disk-butler/`）以三种形态发布：

- **DSH 插件**：`package.json#dsh.bundle.patch` → `cordis.patch.yml` → `index.js`
  通过 `ctx.skills.register()` 注册技能，`resourceBase` 指向技能目录
- **Codex/OpenAI 插件**：`.codex-plugin/plugin.json`
- **通用 agent skill**：`skills/disk-butler/SKILL.md`

### 新增 —— 开发防线

- `scripts/Fix-Bom.ps1`：BOM 校正。`.ps1` 必须有 BOM、`SKILL.md` 必须没有。
  这个坑在开发过程中犯了三次，所以做成了一条命令。
- `scripts/self-test.mjs`：用 mock 的 Cordis 上下文真实调用 `apply()`，
  外加解析器单元测试（含 **CRLF 用例**——见下方修复）。
- `Test-SkillHealth.ps1`：30 项自检，覆盖 BOM、语法、文件读写编码、
  `@()` 误用在 `List[object]` 上、frontmatter 有效性、技能目录纯净度、
  插件清单字段、npm 打包内容。
- `.github/workflows/verify.yml`：CI 跑上面全部。

### 修复

- **CRLF 行尾下 frontmatter 解析失败**：解析器原先用 `startsWith('---\n')` 判断，
  在 CRLF 文件上直接失效，导致技能描述被**静默丢弃**（不报错）。
  Windows 编辑器默认保存 CRLF，所以这个 bug 很容易被触发。
  现已改为按行解析并对三种行尾都做处理，并加了单元测试锁住。
- **`@()` 作用在 `List[object]` 上抛异常**：PS 5.1 的怪异行为——
  `@()` 对 `List[object]` 不适用（连空 List 都炸），但对其它泛型 List 正常。
  已改用 `.ToArray()`，并加了静态检查防止复发。
- **`if` 语句输出被单元素拆包**：`Entries = if (...) { @(单元素数组) }` 会得到单个对象，
  `.Count` 取不到值，表现为「合计 0 项」这类**静默错误**。
  已改为 `@(if (...) { ... })`——`@()` 必须包在最外层。
- **环境变量保护过度**：`%TEMP%` 被整体拒绝清理，一次性损失 500+ MB 清理能力。
  现改为区分模式：整体删除拒绝，按时间清理允许但降级为 `Confirm`。
- **快速刷新会毁掉体积页**：`-SkipSizes` 时原先会用「未扫描」占位符覆盖体积页。
  现在改为沿用上次数据并在页面上标注时效。
- **日志与迁移记录写进技能目录**：会被 npm 打包发出去，且技能目录在别人的安装环境里是只读的。
  已改到 `%LOCALAPPDATA%\disk-butler\`。

[未发布]: https://github.com/Aurirlk/disk-butler/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Aurirlk/disk-butler/releases/tag/v0.1.0
