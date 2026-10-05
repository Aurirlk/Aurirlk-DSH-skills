# disk-butler · Windows 电脑管家

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

> 给 AI agent 用的 Windows 电脑管家，两条主线：
> **①查询**（只读）：回答「装了什么 / 空间去哪了 / 这个能删吗 / 某个目录里到底是什么 / 什么时候开始变大的」
> **②操作**（有副作用）：按安全等级清理垃圾 → 用 NTFS Junction 透明迁移缓存 → 留档
>
> 同时是 DSH 插件（`dsh.bundle.patch`）和通用 agent skill（`SKILL.md`）。

---

> ## ⚠️ 这个工具会永久删除文件
>
> `Invoke-Cleanup.ps1` 在加了 `-Execute` 之后**会真正删除文件，不进回收站**。
> 请务必先读完下面的「安全模型」再使用。
>
> **它做过的防护**（不是保证，是设计）：
> - 扫描器**永不删除**，只产出计划
> - 执行器**默认预演**，不加 `-Execute` 什么都不会发生
> - 删除前对每一项重新校验：环境变量锚点 / 备份子目录 / 进程占用 / 管理员权限
> - 拿不准可以先 `-Quarantine` 移进隔离区，观察几天再决定
>
> **它不能替你判断的**：某个目录对你的业务是否重要。机器查不出「用户认为这东西重要」，
> 所以任何删除前请自己确认。
>
> 作者不对使用本工具造成的任何数据丢失负责。**先在无关紧要的目录上试一次。**

---

## 它解决什么问题

「C 盘满了」这类需求，agent 自己扫一遍盘往往有两个后果：**删错东西**，和**下次还得再扫一遍**。

disk-butler 的做法：

1. **扫描器永不删除**，只产出带安全等级的清理计划
2. **执行器默认预演**，必须显式 `-Execute`；执行时**重新校验**安全规则（纵深防御）
3. **拿不准可以先隔离**，`-Quarantine` 移进同盘隔离区，可恢复、可观察、可再彻底删
4. **缓存迁移用 NTFS Junction**，对应用完全透明，带回退记录
5. **结论留档**成本机档案，下次直接读，不重复扫盘

## 四个脚本各管一件事

| 脚本 | 干什么 | 副作用 |
|---|---|---|
| `Find-Junk.ps1` | 扫描 10 类垃圾，产出带安全等级的计划 | 无（只读） |
| `Invoke-Cleanup.ps1` | 执行计划；也管理隔离区（列出/恢复/彻底删） | 有 |
| `Move-Cache.ps1` | Junction 透明迁移缓存 + 回退 | 有 |
| `Get-Drilldown.ps1` | 逐层下钻，答「这个目录里到底是什么」 | 无（只读） |
| `Get-Trend.ps1` | 把累积快照变成空间趋势与涨跌榜 | 无（只读） |
| `Update-Wiki.ps1` | 生成/刷新本机档案（并自动重算趋势页） | 有（写文件） |
| `Test-SkillHealth.ps1` | 技能自检（28 项） | 无 |

## 实测效果（一台真实开发机）

| 分类 | 识别出的可清理空间 |
|---|---|
| 浏览器缓存（Chrome / Edge 的 Cache、Code Cache、CacheStorage） | 5.06 GB |
| `%TEMP%` 中超 7 天的文件 | 977 MB |
| `~/.cache/<工具>` | 589 MB |
| 包管理器缓存（uv / npm / pip / Maven） | 394 MB |
| **Agent 运行脚本残余**（npx 缓存、`.codex\.tmp`、会话产物） | 223 MB |
| 崩溃转储 | 150 MB |
| **合计** | **约 7.4 GB** |

下钻实例：`C:\Users` 实际占用 **57.52 GB**（50 万文件 / 8.2 万目录），其中 **`AppData` 占 45.96 GB（79.9%）**——这个答案单看顶层目录是得不出来的，要下钻两层。

## 快速开始

```powershell
# 1) 扫描（只读，不删任何东西）
.\skills\disk-butler\scripts\Find-Junk.ps1 -Days 7 -JsonOut "$env:TEMP\junk-plan.json"

# 2) 预演清理（默认就是预演）
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan "$env:TEMP\junk-plan.json"

# 3) 只清"安全"项
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan "$env:TEMP\junk-plan.json" -Execute -Safety Safe

# 3b) 更保守：先移进隔离区，观察几天再彻底删
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan "$env:TEMP\junk-plan.json" -Execute -Safety Safe -Quarantine
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -ListQuarantine
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -PurgeQuarantine -OlderThanDays 7
```

回答「这个目录里到底是什么」：

```powershell
.\skills\disk-butler\scripts\Get-Drilldown.ps1 -Path 'C:\Users' -Top 8 -Depth 3 -MinSizeMB 100 -WithCount
```

迁移写死在 C 盘的缓存：

```powershell
.\skills\disk-butler\scripts\Move-Cache.ps1 -Source "$env:USERPROFILE\.cache\puppeteer" -Destination "E:\Cache\puppeteer"
.\skills\disk-butler\scripts\Move-Cache.ps1 -List                      # 看已迁移
.\skills\disk-butler\scripts\Move-Cache.ps1 -Rollback -Manifest <记录>  # 回退
```

看空间历史趋势：

```powershell
.\skills\disk-butler\scripts\Get-Trend.ps1 -WikiRoot "$env:DISK_BUTLER_WIKI"
```

## 组成

本技能位于合集仓库 [Aurirlk-DSH-skills](../../README.md) 的 `skills/disk-butler/`：

```
Aurirlk-DSH-skills/            ← 合集仓库（顶层还有 index.js / package.json 等打包层）
└── skills/disk-butler/        ← 本技能本体（三套分发共用的唯一真源）
    ├── README.md              本文件：介绍 / 用法 / 安装
    ├── SKILL.md               技能正文：工作流与铁律（agent 读的就是它）
    ├── scripts/
    │   ├── Find-Junk.ps1        扫描器。分类识别，产出计划，**只读**
    │   ├── Invoke-Cleanup.ps1   执行器。重新校验后处理，默认预演；含隔离区管理
    │   ├── Move-Cache.ps1       Junction 透明迁移 + 回退
    │   ├── Get-Drilldown.ps1    目录下钻（单次遍历 + 自底向上汇总）
    │   ├── Get-Trend.ps1        空间趋势与涨跌榜（读全部历史快照）
    │   ├── Update-Wiki.ps1      生成/刷新本机档案（auto/kb 分离）
    │   └── Test-SkillHealth.ps1 技能自检（30 项检查）
    └── references/
        ├── 垃圾分类判据.md       每类的识别规则、安全等级、删除后果
        ├── 缓存迁移手册.md       Junction 的原理、流程、7 个坑
        └── 维护与踩坑.md         改脚本前必读：12 个真实踩过的坑
```

> **为什么技能本体放在 `skills/<名字>/`**：Codex/OpenAI 插件规范要求 `plugin.json` 的 `skills` 字段指向名为 `skills` 的目录；而 DSH 的文件系统技能发现只扫一层（`<根>/<名字>/SKILL.md`）。这个布局同时满足两者，**一份真源，三套包装**。

## 安全模型

**双层校验**：安全规则在扫描时（`Add-Item`）和执行时（`Invoke-Cleanup`）**各查一遍**。

| 规则 | 行为 |
|---|---|
| 目标是环境变量指向的路径 + 整体删除 | **拒绝** |
| 目标是环境变量指向的路径 + 按时间清理 | 允许，但安全等级强制降为 `Confirm` |
| 目标内含 `backup`/`recover`/`备份`/`恢复` 子目录 | **拒绝**，除非 `-Force` |
| 需要管理员但当前无权限 | 跳过并提示 |
| 迁移校验时文件数/字节数不一致 | **中止且不动源目录** |

这套设计经受过实际测试：把含登录凭据的 `~/.codex` 伪造成 `Safe` 项强行执行，被运行时拦下。

## 安装

### 方式一：装整个合集（推荐）

本技能所在仓库同时是一个 npm 包，**装上即注册合集中的全部技能**：

```powershell
# 在 DSH 的 profile 目录里
pnpm add dsh-aurirlk-skills
```

或用 DSH 的插件面板按包名 `dsh-aurirlk-skills` 安装。

### 方式二：只挂这一个技能

DSH 的文件系统技能发现扫描技能根目录下的**一层**子目录（`<根>/<名字>/SKILL.md`），
所以把本技能目录直接挂进去即可，不需要整个仓库：

```powershell
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills

# Windows：Junction 不需要管理员权限（符号链接才需要）
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\disk-butler" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\disk-butler"
```

```bash
# macOS / Linux
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git ~/dev/Aurirlk-DSH-skills
ln -s ~/dev/Aurirlk-DSH-skills/skills/disk-butler ~/.dsh/skills/disk-butler
```

用 Junction/软链的好处是 `git pull` 之后技能自动就是最新的——DSH 会监视技能根目录，
新增/改名/删除**无需重启**。

### 方式三：其它 agent

技能本体就是 `SKILL.md`，**不依赖 DSH**。Claude Code、Codex 等支持 `SKILL.md` 的
agent 都可以直接用这个目录（仓库根带 `.codex-plugin/plugin.json`，可按其插件市场方式引入）。

### 装完怎么确认

```powershell
# 直接问 agent：「查一下我电脑」或「C盘满了」
# 它应当自动加载本技能。也可以手动跑一次自检：
& "$env:USERPROFILE\.dsh\skills\disk-butler\scripts\Test-SkillHealth.ps1" -Deep
```

## 维护

> 下面命令以**仓库根**为当前目录（本技能是合集仓库 `Aurirlk-DSH-skills` 的一员）。

**改完任何文件，按顺序跑这三条**：

```powershell
.\scripts\Fix-Bom.ps1                                    # 0. 先修 BOM（编辑工具会剥掉它）
.\skills\disk-butler\scripts\Test-SkillHealth.ps1 -Deep  # 1. 30 项检查
node scripts\self-test.mjs                               # 2. 合集注册逻辑 + 解析器单测（28 项）
```

**第 0 步不能省，也不能凭记性。** 编辑工具会剥掉 UTF-8 BOM，而运行环境是 Windows PowerShell 5.1——它读无 BOM 的 UTF-8 会按 GBK 解释，中文全乱、脚本直接解析失败。这个坑在开发过程中犯了**三次**，所以现在做成了一条命令。

自检覆盖：`.ps1` 的 BOM 与语法、`SKILL.md` 的 BOM 与 frontmatter、`Get-Content` 缺编码、`@()` 用在 `List[object]` 上、日志混进发布包、插件清单字段缺失、npm 打包内容等。

**背景**：所有脚本的真实运行环境是 **Windows PowerShell 5.1**（不是 PS 7）。这一个事实决定了上面一半的坑——详见 [`references/维护与踩坑.md`](references/维护与踩坑.md)（12 条真实踩过的坑）。

## 已知边界

- **Windows 专用**：依赖 robocopy、NTFS Junction、PowerShell。Linux/macOS 需要另写实现。
- 需要管理员权限的目标（`C:\Windows\Temp`、`SoftwareDistribution\Download`、卷影副本）脚本会标记并跳过。
- 「已用空间」与「能统计到的目录体积」对不上是正常的，差额通常来自受保护的 `System Volume Information`（还原点/卷影副本）。

## 致谢

- **插件入口的写法**参考了 [`dsh-plugin-guide`](https://github.com/PerryLink/dsh-plugin-guide)
  的做法（用 `ctx.skills.register()` 注册技能、`resourceBase` 指向目录）。
  本项目的实现是独立重写的——顺带修掉了原实现在 **CRLF 行尾**下 frontmatter 解析失效的问题，
  并补了单元测试。
- **「Agent 运行脚本残余」这一类**是在真实机器上实测出来的，不是凭想象列的：
  `_npx` 里躺着 agent 跑 `npx -y` 留下的包副本，`.codex\.tmp` 里 94 MB。
- 安全模型里那几条「差点删错」的规则（备份子目录、环境变量锚点）来自真实事故，详见
  [`references/维护与踩坑.md`](references/维护与踩坑.md)。

## 许可

MIT
