<#
  Invoke-Cleanup.ps1 —— 执行清理计划 / 管理隔离区
  ------------------------------------------------------------------
  读 Find-Junk.ps1 产出的计划，重新校验安全规则后执行。

  ## 两种执行方式

  永久删除（默认）：直接 Remove-Item，立刻释放空间，不可撤回。
  隔离区模式（-Quarantine）：把目标移到同盘的隔离区 _DiskButlerQuarantine\，
  可以之后恢复。**注意：隔离不等于释放空间**——空间要等 -PurgeQuarantine 才回来。
  这是"可反悔"与"立刻腾空间"之间的取舍，按需要选。

  隔离区放在**与目标同一个盘**，所以移动是同卷改名（瞬间完成），
  不会变成跨盘复制。

  ## 安全模型

  * 不带 -Execute 时只预演（默认），什么事都不会发生
  * 执行时对每一项重新校验：环境变量锚点、备份子目录、是否需要管理员
  * 按时间清理的项在执行时**重新枚举**，用当下时间判定"过期"
  * 隔离区的恢复不会覆盖已存在的原路径，冲突只报告不覆盖
  * 全程写日志

  ## 怎么用

    # 1) 预演（默认行为，不会删任何东西）
    .\Invoke-Cleanup.ps1 -Plan junk-plan.json

    # 2) 永久删除"安全"项
    .\Invoke-Cleanup.ps1 -Plan junk-plan.json -Execute -Safety Safe

    # 3) 先移进隔离区（可反悔），观察几天
    .\Invoke-Cleanup.ps1 -Plan junk-plan.json -Execute -Safety Safe -Quarantine

    # 4) 只清指定的几项
    .\Invoke-Cleanup.ps1 -Plan junk-plan.json -Execute -Ids temp,agent-residue

    # 5) 管理隔离区
    .\Invoke-Cleanup.ps1 -ListQuarantine                          # 看有什么
    .\Invoke-Cleanup.ps1 -RestoreQuarantine -Batch 20261005-124500 # 恢复某一批
    .\Invoke-Cleanup.ps1 -PurgeQuarantine -OlderThanDays 7        # 彻底删掉超 7 天的
    .\Invoke-Cleanup.ps1 -PurgeQuarantine                         # 全清（真正释放空间）
#>
[CmdletBinding(DefaultParameterSetName='Cleanup')]
param(
    # ---- 清理模式 ----
    [Parameter(ParameterSetName='Cleanup', Mandatory=$true)]
    [string]$Plan,

    [Parameter(ParameterSetName='Cleanup')]
    [switch]$Execute,

    [Parameter(ParameterSetName='Cleanup')]
    [ValidateSet('Safe','Confirm','All')][string]$Safety = 'Safe',

    [Parameter(ParameterSetName='Cleanup')]
    [string[]]$Ids,

    [Parameter(ParameterSetName='Cleanup')]
    [switch]$Force,                      # 跳过"含备份子目录"的阻断

    [Parameter(ParameterSetName='Cleanup')]
    [switch]$Quarantine,                 # 移入隔离区而非永久删除

    # ---- 隔离区管理 ----
    [Parameter(ParameterSetName='ListQ', Mandatory=$true)]
    [switch]$ListQuarantine,

    [Parameter(ParameterSetName='RestoreQ', Mandatory=$true)]
    [switch]$RestoreQuarantine,

    [Parameter(ParameterSetName='RestoreQ', Mandatory=$true)]
    [string]$Batch,

    [Parameter(ParameterSetName='PurgeQ', Mandatory=$true)]
    [switch]$PurgeQuarantine,

    [Parameter(ParameterSetName='PurgeQ')]
    [int]$OlderThanDays = 0,             # 0 = 全清

    # ---- 通用 ----
    [string]$LogDir
)

$ErrorActionPreference = 'Continue'

# 隔离区目录名（建在目标所在盘的根下，保证同卷改名）
$Q_NAME = '_DiskButlerQuarantine'

# 日志写到用户数据目录，不写进技能目录——技能目录是共享只读资源
if (-not $LogDir) {
    $base = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $env:TEMP }
    $LogDir = Join-Path $base 'disk-butler\logs'
}
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$logFile = Join-Path $LogDir ("cleanup-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Log {
    param([string]$Msg, [string]$Color = 'Gray')
    $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Msg
    Write-Host $line -ForegroundColor $Color
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

function Format-Size3 {
    param([double]$Bytes)
    if ($Bytes -ge 1TB) { return ('{0:N2} TB' -f ($Bytes / 1TB)) }
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return ('{0} B' -f [int]$Bytes)
}

# ============================================================ 隔离区基础设施
function Get-FixedVolumes {
    @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue |
      ForEach-Object { $_.DeviceID })
}

function Get-QuarantineBatches {
    <# 扫描所有固定盘，返回隔离区批次。
       不依赖中心索引——每个批次自带 manifest.json，自包含。 #>
    $out = @()
    foreach ($vol in (Get-FixedVolumes)) {
        $root = Join-Path $vol $Q_NAME
        if (-not (Test-Path -LiteralPath $root)) { continue }
        foreach ($b in (Get-ChildItem -LiteralPath $root -Directory -Force -ErrorAction SilentlyContinue)) {
            $mf = Join-Path $b.FullName 'manifest.json'
            $man = $null
            if (Test-Path -LiteralPath $mf) {
                try { $man = Get-Content -LiteralPath $mf -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
            }
            $out += [pscustomobject]@{
                Batch     = $b.Name
                Volume    = $vol
                Path      = $b.FullName
                Manifest  = $man
                CreatedAt = if ($man) { $man.createdAt } else { $b.CreationTime.ToString('o') }
                # ⚠️ 必须写成 @(if (...){...})：把 @() 放在 if **外面**。
                #    写成 if (...) { @(单元素数组) } 的话，if 的输出经管道会被
                #    "单元素拆包"，属性变成单个对象而不是数组，.Count 就取不到了。
                Entries   = @(if ($man) { $man.entries })
            }
        }
    }
    return @($out | Sort-Object CreatedAt -Descending)
}

function Remove-EmptyQuarantineRoot {
    <# 批次目录删完后，如果隔离区根目录也空了，一并清掉——
       否则盘根会永远留一个空的 _DiskButlerQuarantine 目录。 #>
    param([string]$Volume)
    $root = Join-Path $Volume $Q_NAME
    if (-not (Test-Path -LiteralPath $root)) { return }
    $left = @(Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue)
    if ($left.Count -eq 0) {
        Remove-Item -LiteralPath $root -Force -ErrorAction SilentlyContinue
    }
}
function Get-QuarantineVolume {
    param([string]$Path)
    $q = Split-Path -Qualifier $Path -ErrorAction SilentlyContinue
    if (-not $q) { return $null }
    if ($q -notin (Get-FixedVolumes)) { return $null }
    return $q
}

# ============================================================ 隔离区：列出
if ($ListQuarantine) {
    Write-Host ""
    Write-Host "================ 隔离区内容 ================" -ForegroundColor Cyan
    $batches = Get-QuarantineBatches
    if ($batches.Count -eq 0) {
        Write-Host " （隔离区是空的）" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host (" 位置约定：<盘>:\{0}\<批次>\payload\" -f $Q_NAME) -ForegroundColor DarkGray
        Write-Host ""
        exit 0
    }
    $totalAll = 0L
    foreach ($b in $batches) {
        $bytes = 0L
        foreach ($e in $b.Entries) { $bytes += [double]$e.bytes }
        $totalAll += $bytes
        $age = ''
        try { $age = '（{0:N1} 天前）' -f ((Get-Date) - [datetime]$b.CreatedAt).TotalDays } catch { }
        Write-Host ""
        Write-Host (" 批次 {0}   盘 {1}   {2}  {3}" -f $b.Batch, $b.Volume, (Format-Size3 $bytes), $age) -ForegroundColor Green
        Write-Host ("   位置: {0}" -f $b.Path) -ForegroundColor DarkGray
        foreach ($e in ($b.Entries | Sort-Object { -[double]$_.bytes } | Select-Object -First 20)) {
            Write-Host ("    {0,10}  {1}" -f (Format-Size3 ([double]$e.bytes)), $e.original) -ForegroundColor Gray
        }
        if ($b.Entries.Count -gt 20) { Write-Host ("    ...还有 {0} 项" -f ($b.Entries.Count - 20)) -ForegroundColor DarkGray }
    }
    Write-Host ""
    Write-Host (" 合计 {0} 项，占用 {1}" -f (($batches | ForEach-Object { $_.Entries.Count } | Measure-Object -Sum).Sum), (Format-Size3 $totalAll)) -ForegroundColor Cyan
    Write-Host ""
    Write-Host ' ⚠️  这些内容**仍占着磁盘**。隔离区只提供「可反悔」，要真正释放空间必须：' -ForegroundColor Yellow
    Write-Host "      .\Invoke-Cleanup.ps1 -PurgeQuarantine" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# ============================================================ 隔离区：恢复
if ($RestoreQuarantine) {
    Write-Host ""
    Write-Host "================ 恢复隔离区 ================" -ForegroundColor Cyan
    $targets = @(Get-QuarantineBatches | Where-Object { $_.Batch -eq $Batch })
    if ($targets.Count -eq 0) {
        Write-Host (" 找不到批次 '{0}'。用 -ListQuarantine 看有哪些。" -f $Batch) -ForegroundColor Red
        exit 1
    }
    $okCount = 0; $skipCount = 0; $failCount = 0; $bytes = 0L
    foreach ($b in $targets) {
        Write-Host (" 批次 {0}  盘 {1}  共 {2} 项" -f $b.Batch, $b.Volume, $b.Entries.Count) -ForegroundColor Green
        foreach ($e in $b.Entries) {
            $src = $e.quarantined
            $dst = $e.original
            if (-not (Test-Path -LiteralPath $src)) {
                Log ("  跳过：隔离区内已不存在 {0}" -f $src) 'DarkGray'; $skipCount++; continue
            }
            if (Test-Path -LiteralPath $dst) {
                Log ("  跳过：原路径已存在同名内容，不覆盖 → {0}" -f $dst) 'Yellow'; $skipCount++; continue
            }
            try {
                $parent = Split-Path -Parent $dst
                if ($parent -and -not (Test-Path -LiteralPath $parent)) {
                    New-Item -ItemType Directory -Path $parent -Force | Out-Null
                }
                Move-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop
                Log ("  ✅ 已恢复 {0}" -f $dst) 'Green'
                $okCount++; $bytes += [double]$e.bytes
            } catch {
                Log ("  ⚠️  恢复失败 {0}：{1}" -f $dst, $_.Exception.Message) 'Yellow'
                $failCount++
            }
        }
        # 若本批次内容已全部恢复，连 manifest 一起把整个批次目录清掉
        try {
            $payloadDir = Join-Path $b.Path 'payload'
            $remain = 0
            if (Test-Path -LiteralPath $payloadDir) {
                $remain = @(Get-ChildItem -LiteralPath $payloadDir -Recurse -Force -File -ErrorAction SilentlyContinue).Count
            }
            if ($remain -eq 0) {
                Remove-Item -LiteralPath $b.Path -Recurse -Force -ErrorAction SilentlyContinue
                Remove-EmptyQuarantineRoot -Volume $b.Volume
                if (-not (Test-Path -LiteralPath $b.Path)) {
                    Log ("  批次目录已清空: {0}" -f $b.Path) 'DarkGray'
                }
            } else {
                Log ("  批次目录保留（还有 {0} 个文件未恢复）: {1}" -f $remain, $b.Path) 'Yellow'
            }
        } catch { }
    }
    Write-Host ""
    Log ("恢复 {0} 项 / 跳过 {1} 项 / 失败 {2} 项，共 {3}" -f $okCount, $skipCount, $failCount, (Format-Size3 $bytes)) 'Green'
    Write-Host ""
    exit 0
}

# ============================================================ 隔离区：彻底删除
if ($PurgeQuarantine) {
    Write-Host ""
    Write-Host "================ 清空隔离区（永久删除）================" -ForegroundColor Cyan
    if ($OlderThanDays -gt 0) { Write-Host (" 只清超过 {0} 天的批次" -f $OlderThanDays) }
    else { Write-Host " 将清空**全部**批次（没有天数限制）" -ForegroundColor Yellow }

    $batches = Get-QuarantineBatches
    if ($batches.Count -eq 0) { Write-Host " （隔离区是空的）" -ForegroundColor DarkGray; Write-Host ""; exit 0 }

    $freed = 0L; $n = 0
    foreach ($b in $batches) {
        $ageDays = 9999
        try { $ageDays = ((Get-Date) - [datetime]$b.CreatedAt).TotalDays } catch { }
        if ($OlderThanDays -gt 0 -and $ageDays -lt $OlderThanDays) {
            Write-Host (" 跳过批次 {0}（才 {1:N1} 天）" -f $b.Batch, $ageDays) -ForegroundColor DarkGray
            continue
        }
        $bytes = 0L; foreach ($e in $b.Entries) { $bytes += [double]$e.bytes }
        try {
            Remove-Item -LiteralPath $b.Path -Recurse -Force -ErrorAction Stop
            Write-Host ("  ✅ 已删除批次 {0}（{1}，{2:N1} 天前）" -f $b.Batch, (Format-Size3 $bytes), $ageDays) -ForegroundColor Green
            Remove-EmptyQuarantineRoot -Volume $b.Volume
            $freed += $bytes; $n++
        } catch {
            Write-Host ("  ⚠️  删除批次 {0} 失败：{1}" -f $b.Batch, $_.Exception.Message) -ForegroundColor Yellow
        }
    }
    Write-Host ""
    Log ("已删除 {0} 个批次，释放 {1}" -f $n, (Format-Size3 $freed)) 'Green'
    Write-Host ""
    exit 0
}

# ============================================================ 清理模式
if (-not (Test-Path -LiteralPath $Plan)) { throw "找不到计划文件: $Plan" }
$payload = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$items = @($payload.items)

# 环境变量锚点（与扫描器同一套规则）
$script:EnvAnchors = @()
foreach ($e in [Environment]::GetEnvironmentVariables('User').GetEnumerator() +
               [Environment]::GetEnvironmentVariables('Machine').GetEnumerator()) {
    $v = "$($e.Value)"
    if ($v -match '^[A-Za-z]:\\') { $script:EnvAnchors += $v.TrimEnd('\') }
}
function Test-EnvAnchor {
    param([string]$Path)
    $p = $Path.TrimEnd('\')
    foreach ($a in $script:EnvAnchors) { if ($p -ieq $a) { return $a } }
    return $null
}

# 过滤待处理项
$sel = $items | Where-Object {
    ($Safety -eq 'All' -or $_.Safety -eq $Safety -or ($Safety -eq 'Safe' -and $_.Safety -eq 'Safe'))
}
if ($Ids) { $sel = $items | Where-Object { $_.Id -in $Ids -or $_.Category -in $Ids } }
$sel = @($sel)

$mode = if (-not $Execute) { '预演（不会动任何东西）' }
        elseif ($Quarantine) { '隔离（移到隔离区，可恢复；空间要 purge 后才释放）' }
        else { '永久删除' }

Write-Host ""
Write-Host ("================ 清理{0} ================" -f $(if ($Execute) { '执行' } else { '预演' })) -ForegroundColor Cyan
Write-Host (" 计划文件 : {0}" -f $Plan)
Write-Host (" 生成时间 : {0}" -f $payload.generatedAt)
Write-Host (" 模式     : {0}" -f $mode)
Write-Host (" 范围     : Safety={0}{1}" -f $Safety, $(if ($Ids) { "  Ids=$($Ids -join ',')" } else { '' }))
Write-Host (" 待处理   : {0} 项" -f $sel.Count)
Write-Host (" 日志     : {0}" -f $logFile)
Write-Host ""

if ($sel.Count -eq 0) { Log "没有匹配的项。" 'Yellow'; Write-Host ""; exit 0 }

$freedTotal = 0L; $okCount = 0; $skipCount = 0; $failCount = 0
$script:IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

# 隔离区批次：一次运行共用一个批次号，跨盘也一致，便于整体恢复
$script:BatchId = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:QManifests = @{}   # 盘符 -> List[entry]

function Add-QEntry {
    param([string]$Volume, [string]$Id, [string]$Category, [string]$Mode,
          [string]$Original, [string]$Quarantined, [double]$Bytes, [string]$Kind)
    if (-not $script:QManifests.ContainsKey($Volume)) {
        $script:QManifests[$Volume] = New-Object System.Collections.Generic.List[object]
    }
    $script:QManifests[$Volume].Add([pscustomobject]@{
        id = $Id; category = $Category; mode = $Mode
        original = $Original; quarantined = $Quarantined
        bytes = $Bytes; kind = $Kind
    })
}

function Move-ToQuarantine {
    <# 把路径移进同盘隔离区。返回 $true 表示成功。
       隔离区建在目标所在盘的根下，所以是**同卷改名**（瞬间完成），
       不会退化成跨盘复制。 #>
    param([string]$Path, [string]$Volume, [string]$Id, [string]$Category,
          [string]$ItemMode, [double]$Bytes, [string]$Kind)
    $rel = $Path.Substring($Volume.Length).TrimStart('\')
    if ([string]::IsNullOrWhiteSpace($rel)) { return $false }
    $dest = Join-Path (Join-Path (Join-Path $Volume $Q_NAME) $script:BatchId) (Join-Path 'payload' $rel)
    $destParent = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
    if (Test-Path -LiteralPath $dest) { return $false }   # 不该发生：批内路径唯一
    Move-Item -LiteralPath $Path -Destination $dest -Force -ErrorAction Stop
    Add-QEntry -Volume $Volume -Id $Id -Category $Category -Mode $ItemMode `
               -Original $Path -Quarantined $dest -Bytes $Bytes -Kind $Kind
    return $true
}

foreach ($item in ($sel | Sort-Object Bytes -Descending)) {
    $target = $item.Target
    Write-Host ("--- {0}  [{1}]  {2}" -f $item.Id, $item.Safety, $target) -ForegroundColor White

    # ============ 执行前的重新校验 ============
    if (-not (Test-Path -LiteralPath $target)) {
        Log "  跳过：目标已不存在" 'DarkGray'; $skipCount++; continue
    }

    if ($item.Mode -eq 'WholeDir') {
        $anchor = Test-EnvAnchor $target
        if ($anchor) {
            Log "  拒绝：这是环境变量指向的活跃位置（$anchor），不允许整体删除或隔离" 'Red'
            $skipCount++; continue
        }
    }

    if ($item.HasBackupSub -and -not $Force) {
        Log "  拒绝：目标内部含备份/恢复类子目录。确认无用后加 -Force 再试" 'Red'
        $skipCount++; continue
    }

    if ($item.NeedsAdmin -and -not $script:IsAdmin) {
        Log "  跳过：需要管理员权限（请用管理员终端重跑）" 'Yellow'
        $skipCount++; continue
    }

    if ($Quarantine) {
        $vol = Get-QuarantineVolume -Path $target
        if (-not $vol) {
            Log "  拒绝：无法确定目标所在盘，隔离区要求同卷。请改用永久删除模式" 'Red'
            $skipCount++; continue
        }
    }

    # ============ 预演 ============
    if (-not $Execute) {
        $verb = if ($Quarantine) { '将移入隔离区' } else { '将释放' }
        Log ("  {0} {1}（{2} 个对象）" -f $verb, (Format-Size3 $item.Bytes), $item.ItemCount) 'DarkCyan'
        $freedTotal += $item.Bytes; $okCount++
        continue
    }

    # ============ 实际执行 ============
    $before = 0L
    try {
        if ($item.Mode -eq 'AgeFilter') {
            # 重新枚举：用当下时间重新判定"过期"，不用计划里的旧结果
            $cutoff = (Get-Date).AddDays(-[int]$item.OlderThanDays)
            $victims = @(Get-ChildItem -LiteralPath $target -Recurse -Force -File -ErrorAction SilentlyContinue |
                         Where-Object { $_.LastWriteTime -lt $cutoff })
            foreach ($v in $victims) {
                try {
                    if ($Quarantine) {
                        if (Move-ToQuarantine -Path $v.FullName -Volume $vol -Id $item.Id `
                                -Category $item.Category -ItemMode 'File' -Bytes $v.Length -Kind 'file') {
                            $before += $v.Length
                        }
                    } else {
                        $before += $v.Length
                        Remove-Item -LiteralPath $v.FullName -Force -ErrorAction Stop
                    }
                } catch { }
            }
            # 顺手清掉因此变空的子目录（隔离模式下空目录不会被恢复，直接删）
            Get-ChildItem -LiteralPath $target -Recurse -Force -Directory -ErrorAction SilentlyContinue |
                Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
                    try { if (-not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue)) {
                        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop } } catch { }
                }
        }
        else {
            $before = $item.Bytes
            if ($Quarantine) {
                if (Move-ToQuarantine -Path $target -Volume $vol -Id $item.Id `
                        -Category $item.Category -ItemMode 'WholeDir' -Bytes $item.Bytes -Kind 'dir') {
                    # 成功
                } else {
                    throw "移入隔离区失败（目标冲突或不可移动）"
                }
            } else {
                Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
            }
        }
        if ($Quarantine) {
            Log ("  ✅ 已移入隔离区 {0}（空间待 purge 后释放）" -f (Format-Size3 $before)) 'Green'
        } else {
            Log ("  ✅ 已清理，释放 {0}" -f (Format-Size3 $before)) 'Green'
        }
        $freedTotal += $before; $okCount++
    }
    catch {
        Log ("  ⚠️  部分失败：{0}" -f $_.Exception.Message) 'Yellow'
        $failCount++
    }
}

# ---------------------------------------------------------------- 写隔离区 manifest
if ($Quarantine -and $script:QManifests.Count -gt 0) {
    foreach ($vol in $script:QManifests.Keys) {
        $entries = $script:QManifests[$vol]
        if ($entries.Count -eq 0) { continue }
        $batchDir = Join-Path (Join-Path $vol $Q_NAME) $script:BatchId
        if (-not (Test-Path -LiteralPath $batchDir)) { New-Item -ItemType Directory -Path $batchDir -Force | Out-Null }
        # ⚠️ 不能写 @($entries)：$entries 是 List[object]，而 PS 5.1 下 @() 作用在
        #    List[object] 上会抛"参数类型不匹配"（连空 List 都会炸）。必须用 .ToArray()。
        $entryArr = $entries.ToArray()
        $manifest = [pscustomobject]@{
            schemaVersion = 1
            batch         = $script:BatchId
            volume        = $vol
            createdAt     = (Get-Date).ToString('o')
            computer      = $env:COMPUTERNAME
            planFile      = (Resolve-Path -LiteralPath $Plan).Path
            entryCount    = $entryArr.Count
            totalBytes    = ($entryArr | ForEach-Object { [double]$_.bytes } | Measure-Object -Sum).Sum
            entries       = $entryArr
        }
        $mf = Join-Path $batchDir 'manifest.json'
        [System.IO.File]::WriteAllText($mf, ($manifest | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($true)))
        Write-Host ""
        Write-Host (" 隔离批次 {0} @ {1}：{2} 项，{3}" -f $script:BatchId, $vol, $entries.Count,
            (Format-Size3 $manifest.totalBytes)) -ForegroundColor Green
        Write-Host ("   位置: {0}" -f $batchDir) -ForegroundColor DarkGray
    }
}

# ---------------------------------------------------------------- 收尾
Write-Host ""
Write-Host "================ 结果 ================" -ForegroundColor Cyan
Log ("成功 {0} 项 / 跳过 {1} 项 / 部分失败 {2} 项" -f $okCount, $skipCount, $failCount)
if ($Quarantine -and $Execute) {
    Log ("已移入隔离区 {0}　⚠️ 空间尚未释放" -f (Format-Size3 $freedTotal)) 'Yellow'
    Log "要真正释放空间： .\Invoke-Cleanup.ps1 -PurgeQuarantine" 'Yellow'
    Log "想反悔：         .\Invoke-Cleanup.ps1 -RestoreQuarantine -Batch <批次号>" 'Yellow'
} else {
    Log ("$(if ($Execute) { '已释放' } else { '预计可释放' }) {0}" -f (Format-Size3 $freedTotal)) 'Green'
}

if (-not $Execute) {
    Write-Host ""
    Write-Host " 以上是预演结果。确认无误后加上 -Execute 真正执行，例如：" -ForegroundColor Yellow
    Write-Host ("   .\Invoke-Cleanup.ps1 -Plan `"{0}`" -Execute -Safety Safe" -f $Plan) -ForegroundColor Yellow
    Write-Host ("   .\Invoke-Cleanup.ps1 -Plan `"{0}`" -Execute -Safety Safe -Quarantine   # 更保守：先进隔离区" -f $Plan) -ForegroundColor Yellow
}

Write-Host ""
Write-Host (" 日志: {0}" -f $logFile) -ForegroundColor Gray
Write-Host ""
