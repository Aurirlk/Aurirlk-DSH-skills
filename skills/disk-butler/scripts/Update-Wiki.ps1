<#
  PC-Wiki 采集引擎
  ------------------------------------------------------------------
  扫描本机状态，重新生成 <档案根>\auto\ 下的全部页面，
  保存一份 JSON 快照到 data\，并与上一次快照对比后追加到 history\变更日志.md。

  设计原则：
    auto\     脚本生成，每次刷新整体覆盖，请勿手工编辑
    kb\       人工知识，本脚本绝不触碰
    data\     机器可读快照
    history\  快照与变更日志

  用法：
    .\Update-Wiki.ps1                 # 完整刷新（含目录体积扫描，耗时数分钟）
    .\Update-Wiki.ps1 -SkipSizes      # 快速刷新（跳过体积扫描，约 10 秒）
    .\Update-Wiki.ps1 -Drives D,E     # 只扫描指定盘
#>
[CmdletBinding()]
param(
    # 档案根目录：优先环境变量 DISK_BUTLER_WIKI，其次 ~\PC-Wiki
    [string]   $WikiRoot = $(if ($env:DISK_BUTLER_WIKI) { $env:DISK_BUTLER_WIKI } else { Join-Path $env:USERPROFILE 'PC-Wiki' }),
    [switch]   $SkipSizes,
    [string[]] $Drives,
    [int]      $SizeChangeThresholdMB = 200
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'Continue'

$AutoDir = Join-Path $WikiRoot 'auto'
$DataDir = Join-Path $WikiRoot 'data'
$HistDir = Join-Path $WikiRoot 'history'
foreach ($d in $AutoDir, $DataDir, $HistDir) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

$Stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$NowStr  = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$Host_   = $env:COMPUTERNAME
$script:HasRobocopy = [bool](Get-Command robocopy -ErrorAction SilentlyContinue)

# ------------------------------------------------------------------ 工具函数
function Save-Text {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($true)))
}

function Format-Size {
    param([double]$Bytes)
    if ($Bytes -ge 1TB) { return ('{0:N2} TB' -f ($Bytes / 1TB)) }
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return ('{0} B' -f [int]$Bytes)
}

# 统一的键/值访问器。
# 注意：不能对字典用 $obj.PSObject.Properties 去遍历键——那样会把 .NET 自带的
# Values / Keys / Count 等属性也当成键，取到的值是整块集合而不是单个条目。
function Get-Keys {
    param($Obj)
    if ($null -eq $Obj) { return @() }
    if ($Obj -is [System.Collections.IDictionary]) { return @($Obj.Keys) }
    return @($Obj.PSObject.Properties.Name)
}

function Get-Val {
    param($Obj, [string]$Key)
    if ($null -eq $Obj) { return $null }
    if ($Obj -is [System.Collections.IDictionary]) { return $Obj[$Key] }
    $p = $Obj.PSObject.Properties[$Key]
    if ($p) { return $p.Value }
    return $null
}

function Get-DirSizeBytes {
    <# 统计目录递归体积。
       优先用 robocopy 的列举模式（/L），它比 Get-ChildItem -Recurse 快一个数量级；
       robocopy 不可用或解析失败时回退到 .NET 枚举。 #>
    param([string]$Path)

    if ($script:HasRobocopy) {
        try {
            $out = robocopy $Path 'C:\__pcwiki_null__' /L /E /BYTES /XJ /NFL /NDL /NJH /NP /R:0 /W:0 2>$null
            foreach ($l in $out) {
                if ($l -match '^\s*Bytes\s*:\s*(\d+)') { return [double]$Matches[1] }
            }
        } catch { }
    }

    # 回退：.NET 目录枚举（显式栈，避免递归过深）
    $total = 0L
    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push($Path)
    while ($stack.Count -gt 0) {
        $cur = $stack.Pop()
        try { foreach ($f in [System.IO.Directory]::EnumerateFiles($cur)) { try { $total += ([System.IO.FileInfo]$f).Length } catch {} } } catch {}
        try { foreach ($s in [System.IO.Directory]::EnumerateDirectories($cur)) { $stack.Push($s) } } catch {}
    }
    return [double]$total
}

# ================================================================== 采集
Write-Host ""
Write-Host "================ PC-Wiki 刷新 ================" -ForegroundColor Cyan
Write-Host (" 目标: {0}" -f $WikiRoot)
Write-Host (" 时间: {0}" -f $NowStr)
Write-Host ""

$snap = [ordered]@{ timestamp = (Get-Date).ToString('o'); computer = $Host_ }

# ---- 1. 系统与硬件 ----
Write-Host "[1/8] 系统与硬件 ..." -ForegroundColor Yellow
try {
    $os   = Get-CimInstance Win32_OperatingSystem
    $cs   = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1
    $gpus = @(Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, @{n='VRAM_MB';e={[int]($_.AdapterRAM/1MB)}})
    $ramSticks = @(Get-CimInstance Win32_PhysicalMemory | Select-Object @{n='CapacityGB';e={[math]::Round($_.Capacity/1GB,1)}}, Speed, Manufacturer, PartNumber, DeviceLocator)
    $snap.hardware = [ordered]@{
        Manufacturer = $cs.Manufacturer; Model = $cs.Model
        CPU          = $cpu.Name; Cores = $cpu.NumberOfCores; Threads = $cpu.NumberOfLogicalProcessors
        RAM_GB       = [math]::Round($cs.TotalPhysicalMemory/1GB,1)
        RAMSticks    = $ramSticks
        GPU          = $gpus
        BIOS         = "$($bios.Manufacturer) $($bios.SMBIOSBIOSVersion)"
        SerialNumber = $cs.PCSystemProductSKU
    }
    $snap.os = [ordered]@{
        Caption = $os.Caption; Version = $os.Version; Build = $os.BuildNumber
        Arch = $os.OSArchitecture; InstallDate = "$($os.InstallDate)"
        LastBoot = "$($os.LastBootUpTime)"
        SystemDrive = $os.SystemDrive
        WindowsDir = $os.WindowsDirectory
    }
} catch { Write-Host "      失败: $($_.Exception.Message)" -ForegroundColor Red }

# ---- 2. 磁盘 / 分区 / 物理盘 ----
Write-Host "[2/8] 磁盘与分区 ..." -ForegroundColor Yellow
try {
    $snap.disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
        [ordered]@{
            Drive   = $_.DeviceID
            Label   = $_.VolumeName
            FS      = $_.FileSystem
            SizeGB  = [math]::Round($_.Size/1GB,1)
            FreeGB  = [math]::Round($_.FreeSpace/1GB,1)
            UsedPct = if ($_.Size) { [math]::Round(100 - $_.FreeSpace/$_.Size*100,1) } else { 0 }
        }
    })
    $snap.physicalDisks = @(Get-PhysicalDisk | ForEach-Object {
        [ordered]@{ Id=$_.DeviceId; Name=$_.FriendlyName; Media=$_.MediaType; Bus=$_.BusType
                    SizeGB=[math]::Round($_.Size/1GB,1); Health=$_.HealthStatus }
    })
} catch { Write-Host "      失败: $($_.Exception.Message)" -ForegroundColor Red }

# ---- 3. 已安装软件 ----
Write-Host "[3/8] 已安装软件 ..." -ForegroundColor Yellow
try {
    $keys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $sw = foreach ($k in $keys) {
        Get-ItemProperty $k -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -and -not $_.SystemComponent } |
            ForEach-Object {
                [ordered]@{
                    Name      = $_.DisplayName
                    Version   = $_.DisplayVersion
                    Publisher = $_.Publisher
                    Date      = $_.InstallDate
                    Location  = $_.InstallLocation
                    EstMB     = if ($_.EstimatedSize) { [math]::Round($_.EstimatedSize/1024,1) } else { $null }
                }
            }
    }
    $snap.software = @($sw | Sort-Object { $_.Name } -Unique)
} catch { Write-Host "      失败: $($_.Exception.Message)" -ForegroundColor Red }

# ---- 4. 开发环境 ----
Write-Host "[4/8] 开发环境 ..." -ForegroundColor Yellow
try {
    $probes = @(
        @{n='Node.js'; c='node';    a=@('-v')},
        @{n='npm';     c='npm';     a=@('-v')},
        @{n='pnpm';    c='pnpm';    a=@('-v')},
        @{n='Yarn';    c='yarn';    a=@('-v')},
        @{n='Bun';     c='bun';     a=@('--version')},
        @{n='Python';  c='python';  a=@('--version')},
        @{n='pip';     c='pip';     a=@('--version')},
        @{n='Java';    c='java';    a=@('-version')},
        @{n='Maven';   c='mvn';     a=@('-v')},
        @{n='Gradle';  c='gradle';  a=@('-v')},
        @{n='Git';     c='git';     a=@('--version')},
        @{n='Go';      c='go';      a=@('version')},
        @{n='Rust';    c='rustc';   a=@('--version')},
        @{n='.NET';    c='dotnet';  a=@('--version')},
        @{n='Docker';  c='docker';  a=@('--version')},
        @{n='kubectl'; c='kubectl'; a=@('version','--client','--short')},
        @{n='FFmpeg';  c='ffmpeg';  a=@('-version')}
    )
    $dev = foreach ($p in $probes) {
        $cmd = Get-Command $p.c -ErrorAction SilentlyContinue
        $ver = $null
        if ($cmd) { try { $ver = (& $p.c @($p.a) 2>&1 | Select-Object -First 1) -as [string] } catch { $ver = '(探测失败)' } }
        [ordered]@{
            Tool    = $p.n
            Found   = [bool]$cmd
            Path    = if ($cmd) { $cmd.Source } else { $null }
            Version = if ($ver) { $ver.Trim() } else { $null }
        }
    }
    $snap.devEnv = @($dev)

    # 包管理器全局目录配置
    $pkgCfg = [ordered]@{}
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $pkgCfg.npm_prefix   = (& npm config get prefix 2>$null)
        $pkgCfg.npm_cache    = (& npm config get cache  2>$null)
        $pkgCfg.npm_registry = (& npm config get registry 2>$null)
    }
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        $pkgCfg.pnpm_store = (& pnpm store path 2>$null)
        $pkgCfg.pnpm_cache = (& pnpm config get cache-dir 2>$null)
    }
    $pkgCfg.PNPM_HOME = [Environment]::GetEnvironmentVariable('PNPM_HOME','User')
    $snap.packageManagers = $pkgCfg
} catch { Write-Host "      失败: $($_.Exception.Message)" -ForegroundColor Red }

# ---- 5. 服务 ----
Write-Host "[5/8] 服务 ..." -ForegroundColor Yellow
try {
    # 顺带记录"触发启动"标记：这类服务 Running↔Stopped 是常态，
    # 差异对比时要跳过，否则变更日志会被无意义的状态抖动淹掉。
    $snap.services = @(Get-CimInstance Win32_Service | ForEach-Object {
        $trig = Test-Path -LiteralPath "HKLM:\SYSTEM\CurrentControlSet\Services\$($_.Name)\TriggerInfo" -ErrorAction SilentlyContinue
        [ordered]@{ Name=$_.Name; Display=$_.DisplayName; State=$_.State
                    Start=$_.StartMode; TriggerStart=[bool]$trig; Path=$_.PathName }
    } | Sort-Object { $_.Name })
} catch { Write-Host "      失败: $($_.Exception.Message)" -ForegroundColor Red }

# ---- 6. 启动项 ----
Write-Host "[6/8] 启动项 ..." -ForegroundColor Yellow
try {
    $startup = @()
    foreach ($s in (Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue)) {
        $startup += [ordered]@{ Name=$s.Name; Command=$s.Command; Location=$s.Location; User=$s.User }
    }
    $snap.startup = @($startup | Sort-Object { $_.Name })
} catch { Write-Host "      失败: $($_.Exception.Message)" -ForegroundColor Red }

# ---- 7. 计划任务（排除微软自带）----
Write-Host "[7/8] 计划任务 ..." -ForegroundColor Yellow
try {
    $snap.tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue |
        Where-Object { $_.TaskPath -notlike '\Microsoft\*' } |
        ForEach-Object {
            $inf = $_ | Get-ScheduledTaskInfo -ErrorAction SilentlyContinue
            [ordered]@{
                Path=$_.TaskPath; Name=$_.TaskName; State="$($_.State)"
                LastRun="$($inf.LastRunTime)"; NextRun="$($inf.NextRunTime)"
                Action=($_.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join ' ; '
            }
        } | Sort-Object { $_.Path + $_.Name })
} catch { Write-Host "      失败: $($_.Exception.Message)" -ForegroundColor Red }

# ---- 8. 环境变量 + 目录体积 ----
Write-Host "[8/8] 环境变量与目录体积 ..." -ForegroundColor Yellow
try {
    $snap.envVars = [ordered]@{
        User    = @([Environment]::GetEnvironmentVariables('User').GetEnumerator()    | ForEach-Object { [ordered]@{K=$_.Key;V="$($_.Value)"} } | Sort-Object K)
        Machine = @([Environment]::GetEnvironmentVariables('Machine').GetEnumerator() | ForEach-Object { [ordered]@{K=$_.Key;V="$($_.Value)"} } | Sort-Object K)
    }
} catch { }

# 先定位上一份快照——体积沿用逻辑和后面的差异对比都要用它
$prevFile = Get-ChildItem (Join-Path $DataDir 'snapshot-*.json') -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
$prev = $null
if ($prevFile) { try { $prev = Get-Content $prevFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $prev = $null } }

if (-not $SkipSizes) {
    if (-not $Drives) { $Drives = @($snap.disks | ForEach-Object { $_.Drive }) }
    $dirSizes = [ordered]@{}
    foreach ($drv in $Drives) {
        Write-Host ("      扫描 {0}\ ..." -f $drv) -ForegroundColor DarkGray
        $tops = Get-ChildItem -LiteralPath "$drv\" -Directory -Force -ErrorAction SilentlyContinue
        $list = foreach ($t in $tops) {
            $b = Get-DirSizeBytes -Path $t.FullName
            [ordered]@{ Path=$t.FullName; Bytes=$b; Kind='目录' }
        }
        # 根目录下的文件（pagefile.sys / hiberfil.sys / swapfile.sys 等）也要算进来，
        # 否则"顶层目录合计"和"该盘已用"永远对不上账。
        $rootFiles = Get-ChildItem -LiteralPath "$drv\" -File -Force -ErrorAction SilentlyContinue
        $list += foreach ($f in $rootFiles) {
            [ordered]@{ Path=$f.FullName; Bytes=[double]$f.Length; Kind='根目录文件' }
        }
        $dirSizes[$drv] = @($list | Sort-Object { $_.Bytes } -Descending)
    }
    $snap.dirSizes     = $dirSizes
    $snap.dirSizesFrom = $NowStr
}
elseif ($prev -and $prev.dirSizes) {
    # 快速模式：不重扫，沿用上一份快照的体积数据，并在页面上显著标注时效
    $snap.dirSizes     = $prev.dirSizes
    $prevStamp = try { ([datetime]$prev.timestamp).ToString('yyyy-MM-dd HH:mm:ss') } catch { "$($prev.timestamp)" }
    $snap.dirSizesFrom = "$prevStamp　（本次 -SkipSizes 未重扫，沿用该次数据）"
    Write-Host "      体积数据沿用上次快照（-SkipSizes）" -ForegroundColor DarkGray
}

# ================================================================== 快照落盘
$snapJson = $snap | ConvertTo-Json -Depth 12
$snapFile = Join-Path $DataDir ("snapshot-{0}.json" -f $Stamp)
Save-Text -Path $snapFile -Content $snapJson
Save-Text -Path (Join-Path $DataDir 'latest.json') -Content $snapJson
Write-Host ""
Write-Host (" 快照已保存: {0}" -f $snapFile) -ForegroundColor Green

# ================================================================== 差异对比
$changes = New-Object System.Collections.Generic.List[string]

if ($prevFile -and $prev) {
    Write-Host (" 对比基准: {0}" -f $prevFile.Name) -ForegroundColor DarkGray

    # 磁盘空间
    foreach ($d in $snap.disks) {
        $p = $prev.disks | Where-Object { $_.Drive -eq $d.Drive } | Select-Object -First 1
        if ($p) {
            $delta = [math]::Round($d.FreeGB - $p.FreeGB, 1)
            if ([math]::Abs($delta) -ge 0.5) {
                $changes.Add(("- **{0}** 可用空间 {1:N1} GB → {2:N1} GB  ({3}{4} GB)" -f `
                    $d.Drive, $p.FreeGB, $d.FreeGB, $(if($delta -gt 0){'+'}else{''}), $delta))
            }
        }
    }

    # 软件增删
    $curNames  = $snap.software  | ForEach-Object { "$($_.Name) $($_.Version)" }
    $prevNames = $prev.software  | ForEach-Object { "$($_.Name) $($_.Version)" }
    $added   = $curNames  | Where-Object { $_ -notin $prevNames }
    $removed = $prevNames | Where-Object { $_ -notin $curNames }
    foreach ($a in $added)   { $changes.Add(("- 新装软件：``{0}``" -f $a)) }
    foreach ($r in $removed) { $changes.Add(("- 卸载软件：``{0}``" -f $r)) }

    # 目录体积变化
    if ($snap.dirSizes -and $prev.dirSizes) {
        foreach ($drv in (Get-Keys $snap.dirSizes)) {
            $prevList = Get-Val $prev.dirSizes $drv
            if (-not $prevList) { continue }
            $curList = @(Get-Val $snap.dirSizes $drv)
            foreach ($cur in $curList) {
                $curPath = Get-Val $cur 'Path'
                $curBytes = [double](Get-Val $cur 'Bytes')
                $p = $prevList | Where-Object { $_.Path -eq $curPath } | Select-Object -First 1
                if (-not $p) {
                    $changes.Add(("- 新增目录：``{0}``（{1}）" -f $curPath, (Format-Size $curBytes)))
                    continue
                }
                $dm = ($curBytes - $p.Bytes) / 1MB
                if ([math]::Abs($dm) -ge $SizeChangeThresholdMB) {
                    $sign = if ($dm -gt 0) { '+' } else { '' }
                    $changes.Add(("- 目录体积：``{0}`` {1} → {2}  ({3}{4:N0} MB)" -f `
                        $curPath, (Format-Size $p.Bytes), (Format-Size $curBytes), $sign, $dm))
                }
            }
            $curPaths = $curList | ForEach-Object { Get-Val $_ 'Path' }
            foreach ($p in $prevList) {
                if ($p.Path -notin $curPaths) { $changes.Add(("- 目录已消失：``{0}``（原 {1}）" -f $p.Path, (Format-Size $p.Bytes))) }
            }
        }
    }

    # 服务变化：只报告"启动方式"变化，以及"自动启动"服务的状态变化。
    # 触发启动（Manual）的服务 Running↔Stopped 是常态，全记下来会把日志淹掉。
    foreach ($s in $snap.services) {
        $p = $prev.services | Where-Object { $_.Name -eq $s.Name } | Select-Object -First 1
        if (-not $p) { continue }
        if ($p.Start -ne $s.Start) {
            $changes.Add(("- 服务 ``{0}`` 启动方式 {1} → {2}" -f $s.Name, $p.Start, $s.Start))
        }
        elseif ($p.State -ne $s.State -and $s.Start -eq 'Auto' -and -not $s.TriggerStart) {
            $changes.Add(("- 服务 ``{0}`` 状态 {1} → {2}（自动启动）" -f $s.Name, $p.State, $s.State))
        }
    }

    # 启动项增删
    $curS  = $snap.startup  | ForEach-Object { $_.Name }
    $prevS = $prev.startup  | ForEach-Object { $_.Name }
    foreach ($a in ($curS  | Where-Object { $_ -notin $prevS })) { $changes.Add(("- 新增启动项：``{0}``" -f $a)) }
    foreach ($r in ($prevS | Where-Object { $_ -notin $curS })) { $changes.Add(("- 移除启动项：``{0}``" -f $r)) }

    # 计划任务增删
    $curT  = $snap.tasks | ForEach-Object { "$($_.Path)$($_.Name)" }
    $prevT = $prev.tasks | ForEach-Object { "$($_.Path)$($_.Name)" }
    foreach ($a in ($curT  | Where-Object { $_ -notin $prevT })) { $changes.Add(("- 新增计划任务：``{0}``" -f $a)) }
    foreach ($r in ($prevT | Where-Object { $_ -notin $curT })) { $changes.Add(("- 移除计划任务：``{0}``" -f $r)) }
}

# ================================================================== 生成 auto/ 页面
$GEN = @"

---
> 本页由 `disk-butler` 技能的 `Update-Wiki.ps1` 于 $NowStr 自动生成，**请勿手工编辑**。
> 要写自己的判断和笔记，请放到 `kb\` 目录下。
"@

function Save-Page { param([string]$Name, [string]$Body)
    Save-Text -Path (Join-Path $AutoDir $Name) -Content ($Body + $GEN)
}

# --- 01 硬件与系统 ---
$h = $snap.hardware; $o = $snap.os
if (-not $h) { $h = [pscustomobject]@{ Manufacturer='(采集失败)'; Model=''; CPU='(采集失败)'; Cores=''; Threads='';
    RAM_GB=''; RAMSticks=@(); GPU=@(); BIOS=''; SerialNumber='' } }
if (-not $o) { $o = [pscustomobject]@{ Caption='(采集失败)'; Version=''; Build=''; Arch='';
    InstallDate=''; LastBoot=''; SystemDrive=''; WindowsDir='' } }
if (-not $snap.packageManagers) { $snap.packageManagers = [ordered]@{} }
if (-not $snap.envVars) { $snap.envVars = [ordered]@{ User=@(); Machine=@() } }
$cpuLine = if ($h) { $h.CPU } else { '?' }
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 硬件与系统')
[void]$sb.AppendLine()
[void]$sb.AppendLine('## 主机')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 项目 | 值 |')
[void]$sb.AppendLine('|---|---|')
[void]$sb.AppendLine("| 计算机名 | $Host_ |")
[void]$sb.AppendLine("| 厂商 / 型号 | $($h.Manufacturer) / $($h.Model) |")
[void]$sb.AppendLine("| 序列号 | $($h.SerialNumber) |")
[void]$sb.AppendLine("| BIOS | $($h.BIOS) |")
[void]$sb.AppendLine()
[void]$sb.AppendLine('## CPU / 内存')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 项目 | 值 |')
[void]$sb.AppendLine('|---|---|')
[void]$sb.AppendLine("| CPU | $cpuLine |")
[void]$sb.AppendLine("| 核心 / 线程 | $($h.Cores) / $($h.Threads) |")
[void]$sb.AppendLine("| 物理内存 | $($h.RAM_GB) GB |")
[void]$sb.AppendLine()
if ($h.RAMSticks) {
    [void]$sb.AppendLine('### 内存条')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('| 容量 | 频率 | 厂商 | 型号 | 插槽 |')
    [void]$sb.AppendLine('|---|---|---|---|---|')
    foreach ($r in $h.RAMSticks) {
        [void]$sb.AppendLine("| $($r.CapacityGB) GB | $($r.Speed) | $($r.Manufacturer) | $($r.PartNumber) | $($r.DeviceLocator) |")
    }
    [void]$sb.AppendLine()
}
if ($h.GPU) {
    [void]$sb.AppendLine('### 显卡')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('| 型号 | 驱动版本 | 显存 |')
    [void]$sb.AppendLine('|---|---|---|')
    foreach ($g in $h.GPU) { [void]$sb.AppendLine("| $($g.Name) | $($g.DriverVersion) | $($g.VRAM_MB) MB |") }
    [void]$sb.AppendLine()
}
[void]$sb.AppendLine('## 操作系统')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 项目 | 值 |')
[void]$sb.AppendLine('|---|---|')
[void]$sb.AppendLine("| 版本 | $($o.Caption) |")
[void]$sb.AppendLine("| 内部版本 | $($o.Version) (Build $($o.Build)) |")
[void]$sb.AppendLine("| 架构 | $($o.Arch) |")
[void]$sb.AppendLine("| 系统盘 / 目录 | $($o.SystemDrive) / $($o.WindowsDir) |")
[void]$sb.AppendLine("| 安装日期 | $($o.InstallDate) |")
[void]$sb.AppendLine("| 上次启动 | $($o.LastBoot) |")
Save-Page -Name '01-硬件与系统.md' -Body $sb.ToString()

# --- 02 磁盘与分区 ---
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 磁盘与分区')
[void]$sb.AppendLine()
[void]$sb.AppendLine('## 物理磁盘')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| # | 型号 | 类型 | 接口 | 容量 | 健康 |')
[void]$sb.AppendLine('|---|---|---|---|---|---|')
foreach ($p in $snap.physicalDisks) {
    [void]$sb.AppendLine("| $($p.Id) | $($p.Name) | $($p.Media) | $($p.Bus) | $($p.SizeGB) GB | $($p.Health) |")
}
[void]$sb.AppendLine()
[void]$sb.AppendLine('## 分区')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 盘符 | 卷标 | 文件系统 | 总容量 | 可用 | 已用 |')
[void]$sb.AppendLine('|---|---|---|---|---|---|')
foreach ($d in $snap.disks) {
    [void]$sb.AppendLine("| $($d.Drive) | $($d.Label) | $($d.FS) | $($d.SizeGB) GB | $($d.FreeGB) GB | $($d.UsedPct)% |")
}
Save-Page -Name '02-磁盘与分区.md' -Body $sb.ToString()

# --- 03 已安装软件 ---
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 已安装软件')
[void]$sb.AppendLine()
[void]$sb.AppendLine(("共 **{0}** 项（来自注册表卸载信息，不含免安装绿色软件）。" -f $snap.software.Count))
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 名称 | 版本 | 发行商 | 安装日期 | 安装位置 |')
[void]$sb.AppendLine('|---|---|---|---|---|')
foreach ($s in $snap.software) {
    $nm = "$($s.Name)" -replace '\|','\|'
    [void]$sb.AppendLine("| $nm | $($s.Version) | $($s.Publisher) | $($s.Date) | $($s.Location) |")
}
Save-Page -Name '03-已装软件.md' -Body $sb.ToString()

# --- 04 开发环境 ---
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 开发环境')
[void]$sb.AppendLine()
[void]$sb.AppendLine('## 工具链')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 工具 | 是否安装 | 版本 | 路径 |')
[void]$sb.AppendLine('|---|---|---|---|')
foreach ($t in $snap.devEnv) {
    $ok = if ($t.Found) { '✅' } else { '—' }
    $v  = if ($t.Version) { ($t.Version -replace '\|','\|') } else { '' }
    [void]$sb.AppendLine("| $($t.Tool) | $ok | $v | $($t.Path) |")
}
[void]$sb.AppendLine()
[void]$sb.AppendLine('## 包管理器目录配置')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 配置项 | 值 |')
[void]$sb.AppendLine('|---|---|')
foreach ($k in (Get-Keys $snap.packageManagers)) {
    [void]$sb.AppendLine("| $k | $(Get-Val $snap.packageManagers $k) |")
}
Save-Page -Name '04-开发环境.md' -Body $sb.ToString()

# --- 05 服务与启动项 ---
$sb = New-Object System.Text.StringBuilder
$running = @($snap.services | Where-Object { $_.State -eq 'Running' })
[void]$sb.AppendLine('# 服务与启动项')
[void]$sb.AppendLine()
[void]$sb.AppendLine(("## 服务（共 {0} 个，运行中 {1} 个）" -f $snap.services.Count, $running.Count))
[void]$sb.AppendLine()
[void]$sb.AppendLine('### 正在运行的服务')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 名称 | 显示名 | 启动方式 |')
[void]$sb.AppendLine('|---|---|---|')
foreach ($s in ($snap.services | Where-Object { $_.State -eq 'Running' })) {
    [void]$sb.AppendLine("| $($s.Name) | $($s.Display) | $($s.Start) |")
}
[void]$sb.AppendLine()
[void]$sb.AppendLine('### 未运行的服务')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 名称 | 显示名 | 启动方式 |')
[void]$sb.AppendLine('|---|---|---|')
foreach ($s in ($snap.services | Where-Object { $_.State -ne 'Running' })) {
    [void]$sb.AppendLine("| $($s.Name) | $($s.Display) | $($s.Start) |")
}
[void]$sb.AppendLine()
[void]$sb.AppendLine(("## 开机启动项（共 {0} 项）" -f $snap.startup.Count))
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 名称 | 位置 | 命令 |')
[void]$sb.AppendLine('|---|---|---|')
foreach ($s in $snap.startup) {
    $cmd = "$($s.Command)" -replace '\|','\|'
    [void]$sb.AppendLine("| $($s.Name) | $($s.Location) | $cmd |")
}
Save-Page -Name '05-服务与启动项.md' -Body $sb.ToString()

# --- 06 计划任务 ---
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 计划任务（非微软自带）')
[void]$sb.AppendLine()
[void]$sb.AppendLine(("共 **{0}** 项。" -f $snap.tasks.Count))
[void]$sb.AppendLine()
[void]$sb.AppendLine('| 任务 | 状态 | 上次运行 | 下次运行 | 动作 |')
[void]$sb.AppendLine('|---|---|---|---|---|')
foreach ($t in $snap.tasks) {
    $act = "$($t.Action)" -replace '\|','\|'
    if ($act.Length -gt 90) { $act = $act.Substring(0,90) + '…' }
    [void]$sb.AppendLine("| $($t.Path)$($t.Name) | $($t.State) | $($t.LastRun) | $($t.NextRun) | $act |")
}
Save-Page -Name '06-定时任务.md' -Body $sb.ToString()

# --- 07 目录体积 ---
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 目录体积清单')
[void]$sb.AppendLine()
if ($snap.dirSizes) {
    [void]$sb.AppendLine('各盘**顶层目录**的递归体积 + **根目录下的文件**（pagefile.sys、hiberfil.sys 等），按大小降序。')
    [void]$sb.AppendLine('加上根目录文件后，"合计"应与"该盘已用"基本吻合，对不上就说明有权限读不到的角落。')
    [void]$sb.AppendLine()
    if ($snap.dirSizesFrom) {
        [void]$sb.AppendLine(("> 体积数据采集于：**{0}**" -f $snap.dirSizesFrom))
        [void]$sb.AppendLine()
    }
    foreach ($drv in (Get-Keys $snap.dirSizes)) {
        $entries = @(Get-Val $snap.dirSizes $drv)
        $total = ($entries | ForEach-Object { [double](Get-Val $_ 'Bytes') } | Measure-Object -Sum).Sum
        if (-not $total) { $total = 0 }
        $d = $snap.disks | Where-Object { $_.Drive -eq $drv } | Select-Object -First 1
        [void]$sb.AppendLine(("## {0}  （顶层目录合计 {1}{2}）" -f $drv, (Format-Size $total),
            $(if ($d) { "，该盘已用 $([math]::Round($d.SizeGB - $d.FreeGB,1)) GB" } else { "" })))
        [void]$sb.AppendLine()
        [void]$sb.AppendLine('| 项目 | 类型 | 体积 | 占比 |')
        [void]$sb.AppendLine('|---|---|---|---|')
        foreach ($e in $entries) {
            $eb = [double](Get-Val $e 'Bytes')
            $pct = if ($total -gt 0) { [math]::Round($eb / $total * 100, 1) } else { 0 }
            $kind = Get-Val $e 'Kind'; if (-not $kind) { $kind = '目录' }
            [void]$sb.AppendLine(("| ``{0}`` | {1} | {2} | {3}% |" -f (Get-Val $e 'Path'), $kind, (Format-Size $eb), $pct))
        }
        [void]$sb.AppendLine()
        # 主动解释差额，别让"对不上账"变成一个谜
        if ($d) {
            $usedGB   = [math]::Round($d.SizeGB - $d.FreeGB, 1)
            $listedGB = [math]::Round($total / 1GB, 2)
            $gapGB    = [math]::Round($usedGB - $listedGB, 2)
            if ($gapGB -ge 1) {
                [void]$sb.AppendLine(("> **对不上账 {0} GB**：该盘已用 {1} GB，能统计到的只有 {2} GB。" -f $gapGB, $usedGB, $listedGB))
                [void]$sb.AppendLine('> 最常见的原因是 ``System Volume Information``（系统还原点 / 卷影副本）——它受系统保护，')
                [void]$sb.AppendLine('> 普通权限读不到，所以在上面显示为 0 B。**差额本身通常就是还原点占用。**')
                [void]$sb.AppendLine('> 想确认真实占用需要管理员权限：``vssadmin list shadowstorage``')
                [void]$sb.AppendLine()
            }
        }
    }
} else {
    [void]$sb.AppendLine('> 本次以 `-SkipSizes` 运行，且没有可用的历史快照，因此没有体积数据。')
    [void]$sb.AppendLine('> 执行一次完整刷新（双击 `完整刷新.cmd` 或去掉 `-SkipSizes`）即可获得。')
}
Save-Page -Name '07-目录体积清单.md' -Body $sb.ToString()

# --- 08 环境变量 ---
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 环境变量')
[void]$sb.AppendLine()
foreach ($scope in 'User','Machine') {
    $vars = $snap.envVars.$scope
    [void]$sb.AppendLine(("## {0}（{1} 项）" -f $scope, $vars.Count))
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('| 名称 | 值 |')
    [void]$sb.AppendLine('|---|---|')
    foreach ($v in $vars) {
        $val = "$($v.V)" -replace '\|','\|'
        if ($val.Length -gt 160) { $val = $val.Substring(0,160) + '…' }
        [void]$sb.AppendLine(("| ``{0}`` | {1} |" -f $v.K, $val))
    }
    [void]$sb.AppendLine()
}
Save-Page -Name '08-环境变量.md' -Body $sb.ToString()

# ================================================================== 变更日志
$logFile = Join-Path $HistDir '变更日志.md'
if (-not (Test-Path $logFile)) {
    Save-Text -Path $logFile -Content "# 变更日志`n`n每次运行 `disk-butler` 技能的 ``Update-Wiki.ps1`` 时，与上一份快照对比后的差异会追加到这里。最新在最上面。`n"
}
$entry = New-Object System.Text.StringBuilder
[void]$entry.AppendLine()
[void]$entry.AppendLine(("## {0}   ({1})" -f $NowStr, $Stamp))
[void]$entry.AppendLine()
if (-not $prevFile) {
    [void]$entry.AppendLine('- 首次采集，建立基线快照。')
} elseif ($changes.Count -eq 0) {
    [void]$entry.AppendLine('- 与上次相比没有检测到变化。')
} else {
    foreach ($c in $changes) { [void]$entry.AppendLine($c) }
}
$old = Get-Content $logFile -Raw -Encoding UTF8
$head = "# 变更日志`n`n每次运行 `disk-butler` 技能的 ``Update-Wiki.ps1`` 时，与上一份快照对比后的差异会追加到这里。最新在最上面。`n"
Save-Text -Path $logFile -Content ($head + $entry.ToString() + $old.Substring($head.Length))

Write-Host ""
Write-Host (" 变更条目: {0}" -f $changes.Count) -ForegroundColor Green

# --- 空间趋势：把累积的快照变成看得见的历史 ---
# 失败不影响其他页面，只提示
try {
    $trendScript = Join-Path $PSScriptRoot 'Get-Trend.ps1'
    if (Test-Path $trendScript) {
        & $trendScript -WikiRoot $WikiRoot -Quiet
        Write-Host " 已更新: 09-空间趋势.md" -ForegroundColor Green
    }
} catch {
    Write-Host (" 趋势页生成失败（不影响其他页面）: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
}
Write-Host "================ 完成 ================" -ForegroundColor Cyan
Write-Host ""
