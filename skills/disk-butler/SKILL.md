---
name: disk-butler
description: "Windows computer butler / 电脑管家，两条主线。Query（read-only 只读查询）：装了什么、空间去哪了、这个能不能删、某工具怎么配的 —— what is installed, where did my disk space go, is this safe to delete, what is inside this folder. 读本机长期档案，不重复全盘扫描。Operate（有副作用）：扫描垃圾、过期文件与 Agent 运行脚本残余（npx 缓存、工具 .tmp），按安全等级产出清理计划并执行；用 NTFS Junction 把写死在 C 盘的缓存透明迁移到其他盘。Triggers：「C盘满了」「清理磁盘」「空间去哪了」「这个能删吗」「把缓存挪到D盘」；my C drive is full, clean up disk, free up space, can I delete this, move cache to another drive."
whenToUse: "用户提到「我的电脑」「本机」「这台机器」，或询问磁盘空间、目录用途与能否删除、已装软件、开发环境配置、启动项、定时任务、环境变量、清理垃圾与缓存、迁移缓存。Also when the user mentions their PC, this machine or local environment, or asks about disk space, directory purpose and deletability, installed software, dev environment configuration, startup items, scheduled tasks, environment variables, or cleaning and migrating caches。"
---

> Language note: this instruction body is written in Chinese. The frontmatter `description` above is
> bilingual so the skill is discoverable in both languages. An English body is welcome as a
> contribution — see [CONTRIBUTING.md](../../CONTRIBUTING.md).

# 电脑管家

**能查、能扫、能清、能搬、能留档**，并且保证不删错东西。

## 先判断用户要哪条线

| 用户想要 | 走哪条 | 副作用 |
|---|---|---|
| 「装了什么」「空间去哪了」「这个能删吗」「某工具怎么配的」「以前做过什么」 | **A. 查询线** | 无（只读） |
| 「这个目录里到底是什么」「为什么它这么大」 | **A. 查询线**（现场下钻） | 无（只读，但耗时） |
| 「清掉垃圾」「腾空间」「C 盘满了」 | **B. 清理线** | 有 |
| 「把缓存挪到 D/E 盘」 | **C. 迁移线** | 有 |
| 记下结论 | **D. 留档** | 有（写文件） |

**多数问题只需要查询线。先读档案，别一上来就全盘扫描**——那既慢又浪费，而且档案里已经有答案。

档案根目录：`$wiki`。取 `$env:DISK_BUTLER_WIKI`，没设就用 `$env:USERPROFILE\PC-Wiki`。

```powershell
$wiki = $env:DISK_BUTLER_WIKI; if (-not $wiki) { $wiki = Join-Path $env:USERPROFILE 'PC-Wiki' }
```

## 铁律（不管哪条线都要守）

1. **删任何东西之前，先读档案里的禁区清单** `$wiki\kb\04-禁区清单.md`（存在的话）。
   它是人工维护的"不可恢复路径"清单——虚拟机镜像、软件凭据/登录态、文档恢复副本这类。
   **自动安全规则查的是"环境变量锚点"这类机械事实，查不出"用户认为这东西重要"。** 两者都要过。
2. **删除前必须过四道检查**：环境变量锚点、备份/恢复子目录、进程占用、是否需管理员。
   这四道在**扫描时和执行时各查一遍**（纵深防御）——执行时会重新校验，所以即使是旧计划或被篡改的计划，也删不掉环境变量指向的位置。
3. **扫描器永不删除。** `Find-Junk.ps1` 只产出计划；删除只发生在 `Invoke-Cleanup.ps1`，而且**默认是预演**，必须显式 `-Execute`。
4. **拿不准就问用户，不要"顺手"多删。** 用户的数据（下载、文档、聊天文件）永远不是垃圾。

---

## A. 查询线：回答之前先读哪里

| 用户问什么 | 读哪个文件 |
|---|---|
| 空间被什么吃掉了 | `$wiki\auto\07-目录体积清单.md` |
| 这个目录/文件能不能删 | `$wiki\kb\01-目录用途与可删性.md` |
| 动手删之前确认什么 | `$wiki\kb\04-禁区清单.md` |
| 某工具/环境怎么配的 | `$wiki\kb\02-环境与配置速查.md` |
| 以前做过什么、怎么回退 | `$wiki\kb\03-清理与操作记录.md` |
| 最近有什么变化 | `$wiki\history\变更日志.md` |
| 硬件/系统 | `$wiki\auto\01-硬件与系统.md` |
| 磁盘与分区 | `$wiki\auto\02-磁盘与分区.md` |
| 装了哪些软件 | `$wiki\auto\03-已装软件.md` |
| 开发工具链版本 | `$wiki\auto\04-开发环境.md` |
| 服务与开机启动项 | `$wiki\auto\05-服务与启动项.md` |
| 计划任务 | `$wiki\auto\06-定时任务.md` |
| 环境变量 | `$wiki\auto\08-环境变量.md` |
| 什么时候开始变大的、什么在长大 | `$wiki\auto\09-空间趋势.md` |
| 索引本身 | `$wiki\README.md` |

### 档案不够用时：现场下钻

档案的目录体积只到**顶层目录**。用户问「`C:\Users` 那 55 GB 里到底是什么」时，需要现场逐层拆：

```powershell
& "<skill>\scripts\Get-Drilldown.ps1" -Path 'C:\Users' -Top 8 -Depth 3 -MinSizeMB 100 -WithCount
```

它做**一次**完整遍历，再自底向上汇总，所以不会因为"每层重扫"而变成 O(数据量 × 层数)。

**耗时要说在前面**：实测 `C:\Users`（57.5 GB / 50 万文件 / 8.2 万目录）约 **99 秒**；21 GB 的中等目录约 5 秒。跑之前告知用户，或先给一个只到一层的快速答案。

加 `-MarkdownOut <文件>` 可以把结果存成 markdown 放进档案。

### 时效性检查（别拿过期数据当现状）

`auto\07-目录体积清单.md` 顶部有「体积数据采集于：…」；`data\latest.json` 的 `timestamp` 是最近一次采集时间。

- 问**配置、路径、能不能删** → 档案旧一点无所谓，直接用。
- 问**当前**剩余空间或**最近**变化 → 先核对采集时间。超过 7 天就先刷新，或直接读实时值并明确告诉用户"这是实时值，不是档案值"：

```powershell
Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' |
  ForEach-Object { '{0} 可用 {1:N1} GB / 总 {2:N1} GB' -f $_.DeviceID, ($_.FreeSpace/1GB), ($_.Size/1GB) }
```

档案不存在时 → 告诉用户还没有档案，问要不要建一份（走 D 留档）。

---

## B. 清理线

### 第 1 步：扫描（只读）

```powershell
& "<skill>\scripts\Find-Junk.ps1" -Days 7 -JsonOut "$env:TEMP\junk-plan.json"
```

### 第 2 步：读计划，向用户解释

扫描结果按三档安全等级分组：

| 等级 | 含义 | 处理方式 |
|---|---|---|
| ✅ Safe | 删了只会重建，或本来就是垃圾 | 可以直接清 |
| ⚠️ Confirm | 可能含用户数据 / 需管理员 / 影响可感知 | **必须逐项向用户说明再清** |
| 📄 Report | 大文件、用户数据 | **只报告，交给用户判断** |

⚠️ **不要把 Confirm 项偷偷升级成 Safe。** 尤其：
- **浏览器缓存**体积往往最大（实测 Edge 的 Service Worker CacheStorage 单项就 3.25 GB），但清之前要用户关掉浏览器
- **`%TEMP%`** 会被环境变量 `TEMP` 指向，所以扫描器会把它降级为 Confirm——这是刻意的，不要绕过

### 第 3 步：执行

```powershell
# 预演（默认行为，不加 -Execute 什么都不删）
& "<skill>\scripts\Invoke-Cleanup.ps1" -Plan "$env:TEMP\junk-plan.json"

# 只清安全项
& "<skill>\scripts\Invoke-Cleanup.ps1" -Plan "$env:TEMP\junk-plan.json" -Execute -Safety Safe

# 指定项
& "<skill>\scripts\Invoke-Cleanup.ps1" -Plan "$env:TEMP\junk-plan.json" -Execute -Ids temp,agent-residue
```

执行器会：重新校验安全规则 → 按**当下**时间重新判定"过期"（不用计划里的旧结果）→ 逐项处理 → 删掉因此变空的子目录 → 写日志。

### 拿不准就先隔离，别直接删

`-Quarantine` 把目标移进**同盘**的隔离区而不是永久删除，可以反悔：

```powershell
# 移进隔离区（可恢复）
& "<skill>\scripts\Invoke-Cleanup.ps1" -Plan "$env:TEMP\junk-plan.json" -Execute -Safety Safe -Quarantine

# 之后管理它
& "<skill>\scripts\Invoke-Cleanup.ps1" -ListQuarantine                           # 看看有什么
& "<skill>\scripts\Invoke-Cleanup.ps1" -RestoreQuarantine -Batch <批次号>         # 反悔
& "<skill>\scripts\Invoke-Cleanup.ps1" -PurgeQuarantine -OlderThanDays 7         # 观察够了再彻底删
```

**⚠️ 隔离 ≠ 释放空间。** 空间要等 `-PurgeQuarantine` 才回来。这是"可反悔"与"立刻腾空间"的取舍：

| 场景 | 用哪个 |
|---|---|
| 用户只是想腾空间，内容明确是垃圾 | 直接 `-Execute`（永久删除，立刻释放） |
| 内容体积大、用户犹豫、或第一次清某类东西 | `-Quarantine`，观察几天再 purge |
| Confirm 档的项 | **建议一律先隔离** |

隔离区建在**目标所在的盘**根下（`<盘>:\_DiskButlerQuarantine\<批次>\`），所以移动是同卷改名、瞬间完成，不会退化成跨盘复制。内容全部恢复或清除后，空目录会自动收掉。

---

## C. 迁移线：搬走写死在 C 盘的缓存

有些软件的缓存路径改不动（写死在代码或注册表里）。用 Junction 原地留一个链接，数据搬到别的盘，**对程序完全透明**：

```powershell
# 预演
& "<skill>\scripts\Move-Cache.ps1" -Source "$env:USERPROFILE\.cache\puppeteer" -Destination "E:\Cache\puppeteer"

# 执行
& "<skill>\scripts\Move-Cache.ps1" -Source "..." -Destination "..." -Execute

# 查看 / 回退
& "<skill>\scripts\Move-Cache.ps1" -List
& "<skill>\scripts\Move-Cache.ps1" -Rollback -Manifest "<记录>"
```

**流程**：robocopy 到目标 → **校验文件数与字节数一致** → 才删源 → 建 Junction → 校验可读。任何一步失败都中止且源目录不动。

**关键知识**：
- 创建 Junction（`New-Item -ItemType Junction` / `mklink /J`）**不需要管理员权限**，符号链接才需要
- 如果缓存路径本身可以用环境变量配置，**优先改环境变量**，Junction 是退而求其次
- **源和目标不能是同一个盘**（那不释放任何空间）

---

## D. 留档：把结论沉淀下来

```powershell
& "<skill>\scripts\Update-Wiki.ps1" -WikiRoot $wiki            # 完整，几分钟
& "<skill>\scripts\Update-Wiki.ps1" -WikiRoot $wiki -SkipSizes # 快速，约 10 秒
```

档案结构（**自动生成与人工知识严格分离**，这是唯一一条必须守的规矩）：

| 目录 | 性质 | 规矩 |
|---|---|---|
| `auto\` | 脚本每次刷新**整体覆盖** | **绝不手工编辑**——写进去的会在下次刷新消失 |
| `kb\` | 人工知识，脚本从不读写 | 判断、原因、经验都写这里 |
| `data\` `history\` | 快照与变更日志 | 自动维护 |

刷新时还会顺带重算 `auto\09-空间趋势.md`（读全部历史快照，给出各盘可用空间的逐次变化、迷你趋势图、以及"什么在长大/变小"的涨跌榜）。只想单独重算趋势：

```powershell
& "<skill>\scripts\Get-Trend.ps1" -WikiRoot $wiki
```

**趋势页是"长期记忆"真正开始产生价值的地方**：单次快照只能看当下，快照序列才能回答"什么时候开始变大的"。快照少于 3 份时页面会明确说明数据还不足以看出趋势。

**分工原则：数字和清单放 `auto\`（自动更新），判断和原因放 `kb\`（人工维护）。**

所以 `kb\01-目录用途与可删性.md` 里不写具体体积（会变），只写"这是什么、能不能删"；体积写在 `auto\07` 里自动更新。

做完任何有影响的操作（删除、改配置、迁移），**把记录追加到 `kb\03-清理与操作记录.md`**，写清：做了什么、为什么、释放/改变了多少、**怎么回退**。

---

## 分类与判据

见 [`references/垃圾分类判据.md`](references/垃圾分类判据.md)（每类的识别规则、安全等级、删除后果）。
缓存迁移的细节与坑见 [`references/缓存迁移手册.md`](references/缓存迁移手册.md)。

### 重点：Agent 运行脚本残余

这是最容易被忽略、也最该定期清的一类——**AI agent 跑 `npx -y`、开会话、建临时工作区留下的东西**：

| 形态 | 典型路径 | 说明 |
|---|---|---|
| npx 临时安装 | `<npm缓存>\_npx\` | 每次 `npx -y <包>` 留一份解包副本，实测单机 116 MB |
| 会话临时产物 | `%TEMP%\dsh-*`、`%TEMP%\claude`、`%TEMP%\opencode` | 各 agent 的中转目录 |
| 工具 `.tmp` | `~/.codex/.tmp`、`~/.claude/tmp` | 实测单机 94 MB |
| 框架状态 | 项目里的 `.omo\run-continuation\` | 体积小，通常不值得清 |

**注意边界**：这类工具里同时存在**绝不能删的东西**——`auth.json`（登录凭据）、`config.toml`、`sessions\`（会话历史）。所以**只清 `.tmp` / `tmp` / `_npx` 这类明确是临时性质的位置，绝不整体删工具根目录**。

## 判断"能不能删"的四步检查

```powershell
# 1. 有没有环境变量指向它？（指向 = 活跃配置，别整体删）
Get-ChildItem env: | Where-Object { $_.Value -like '*要删的路径关键词*' }

# 2. 里面有没有 backup / recover / 备份 / 恢复 子目录？（有 = 是数据不是缓存）
Get-ChildItem '目标' -Recurse -Directory -Depth 3 |
  Where-Object { $_.Name -match 'backup|recover|restore|备份|恢复|autosave' }

# 3. 有没有进程正在占用？（占用 = 删不干净还可能让程序出错）
Get-Process | Where-Object { $_.Path -like 'C:\*' } | Select-Object ProcessName, Path

# 4. 记下删除前的大小，删完对账
```

## 要改这个技能时

先读 [`references/维护与踩坑.md`](references/维护与踩坑.md)。**改完任何文件，跑一遍自检**：

```powershell
& "<skill>\scripts\Test-SkillHealth.ps1" -Deep
```

它把本项目踩过的坑变成了 25 项可执行检查（BOM、编码、frontmatter、打包内容、插件清单……）。**别用肉眼代替它**——其中「`Get-Content` 缺 `-Encoding`」这一类坑，本项目的脚本里真实存在过 8 处，肉眼看不出来。

## 已知边界

- **需要管理员权限**才能处理的：`C:\Windows\Temp`、`C:\Windows\SoftwareDistribution\Download`、卷影副本（`vssadmin list shadowstorage`）、USN 日志、页面文件配置的写入。脚本会标记 `NeedsAdmin` 并在无权限时自动跳过。
- **"已用空间"与"能统计到的目录体积"对不上是正常的**：差额通常来自受系统保护的 `System Volume Information`（系统还原点/卷影副本），普通权限枚举出来是 0 B。档案里的体积页会自动解释这个差额。
- **免安装绿色软件**不在"已装软件"清单里（那份来自注册表卸载信息）。
- **目录体积只扫到顶层目录 + 根目录文件**，再深一层要现场查。
- **不要把丢进回收站当成清理**——回收站不释放空间，真正腾空间必须永久删除。所以删除前的检查更不能省。
- **本机专属的工具路径**（页面文件迁移脚本、draw.io CLI 等）记在档案的 `kb\02-环境与配置速查.md` 里，不写进本技能——这样技能本身保持通用可发布。
