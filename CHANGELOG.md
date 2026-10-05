# 更新日志

本文件记录本仓库的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **仓库形态**：本仓库是 **Aurirlk 的 DSH 技能合集**，不是单个技能。
> 每个技能一个顶层目录（`skills/<名字>/`），共用仓库级校验与一套 npm 打包。
> 下面的版本号针对**整个合集包**。

## [未发布]

### 计划中

- `README.en.md` 与各技能 `SKILL.md` 的英文版（面向国际用户）
- 英文 `description`：它是技能目录里唯一被模型看到的一行，目前只有中文
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
