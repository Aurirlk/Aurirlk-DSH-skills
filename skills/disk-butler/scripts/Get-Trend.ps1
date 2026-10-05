<#
  Get-Trend.ps1 —— 空间趋势：把累积的快照变成"看得见的历史"
  ------------------------------------------------------------------
  档案每次刷新都会存一份 JSON 快照（data\snapshot-*.json）。本脚本读全部快照，
  生成 auto\09-空间趋势.md：

    * 各盘可用空间的逐次变化表
    * 每个盘的 Unicode 迷你趋势图（sparkline）
    * "涨跌榜"：对比最早与最新快照，找出体积变化最大的目录

  它是"长期记忆"真正开始产生价值的地方——单次快照只能看当下，
  快照序列才能回答"什么时候开始变大的、什么在长大"。

  用法：
    .\Get-Trend.ps1                                  # 用 DISK_BUTLER_WIKI 或 ~\PC-Wiki
    .\Get-Trend.ps1 -WikiRoot D:\MyArchive
    .\Get-Trend.ps1 -Top 15                          # 涨跌榜显示 15 条
#>
[CmdletBinding()]
param(
    [string]$WikiRoot = $(if ($env:DISK_BUTLER_WIKI) { $env:DISK_BUTLER_WIKI } else { Join-Path $env:USERPROFILE 'PC-Wiki' }),
    [int]$Top = 10,
    [int]$MinChangeMB = 100,     # 涨跌榜只显示变化超过这个量的目录
    [switch]$NoWrite,            # 只打印，不写文件
    [switch]$Quiet              # 静默（供 Update-Wiki 调用）
)

$ErrorActionPreference = 'Continue'

$DataDir = Join-Path $WikiRoot 'data'
$AutoDir = Join-Path $WikiRoot 'auto'
if (-not (Test-Path $DataDir)) { throw "找不到快照目录: $DataDir（档案还没建过？）" }

function Format-SizeT {
    param([double]$B)
    if ($B -ge 1TB) { return ('{0:N2} TB' -f ($B/1TB)) }
    if ($B -ge 1GB) { return ('{0:N2} GB' -f ($B/1GB)) }
    if ($B -ge 1MB) { return ('{0:N1} MB' -f ($B/1MB)) }
    if ($B -ge 1KB) { return ('{0:N1} KB' -f ($B/1KB)) }
    return ('{0} B' -f [int]$B)
}

# Unicode 迷你趋势图：把数值序列映射到 8 级方块
$BLOCKS = @([char]0x2581, [char]0x2582, [char]0x2583, [char]0x2584,
            [char]0x2585, [char]0x2586, [char]0x2587, [char]0x2588)
function Get-Sparkline {
    param([double[]]$Values)
    if (-not $Values -or $Values.Count -eq 0) { return '（无数据）' }
    if ($Values.Count -eq 1) { return ('' + $BLOCKS[4]) }
    $min = ($Values | Measure-Object -Minimum).Minimum
    $max = ($Values | Measure-Object -Maximum).Maximum
    if ($max -eq $min) { return (-join (1..$Values.Count | ForEach-Object { $BLOCKS[4] })) }
    $chars = foreach ($v in $Values) {
        $idx = [int][math]::Floor((($v - $min) / ($max - $min)) * 7)
        if ($idx -lt 0) { $idx = 0 }; if ($idx -gt 7) { $idx = 7 }
        $BLOCKS[$idx]
    }
    return (-join $chars)
}

# ============================================================ 读快照
$files = @(Get-ChildItem -LiteralPath $DataDir -Filter 'snapshot-*.json' -File -ErrorAction SilentlyContinue |
           Sort-Object Name)
if ($files.Count -eq 0) { throw "data 目录里没有 snapshot-*.json，先跑一次 Update-Wiki.ps1" }

$snaps = @()
foreach ($f in $files) {
    try {
        $j = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $snaps += [pscustomobject]@{ File = $f.Name; Time = $j.timestamp; Data = $j }
    } catch {
        Write-Warning ("跳过无法解析的快照 {0}: {1}" -f $f.Name, $_.Exception.Message)
    }
}
if ($snaps.Count -eq 0) { throw "所有快照都无法解析" }
$snaps = @($snaps | Sort-Object { [datetime]$_.Time })

if (-not $Quiet) {
    Write-Host ""
    Write-Host "================ 空间趋势 ================" -ForegroundColor Cyan
    Write-Host (" 档案 : {0}" -f $WikiRoot)
    Write-Host (" 快照 : {0} 份，从 {1} 到 {2}" -f $snaps.Count,
        ([datetime]$snaps[0].Time).ToString('yyyy-MM-dd HH:mm'),
        ([datetime]$snaps[-1].Time).ToString('yyyy-MM-dd HH:mm'))
}

# 收集盘符（取所有快照里出现过的并集，这样换硬盘/加盘也不会漏）
$drives = @()
foreach ($s in $snaps) { foreach ($d in $s.Data.disks) { if ($d.Drive -notin $drives) { $drives += $d.Drive } } }
$drives = @($drives | Sort-Object)

# ============================================================ 生成
$md = New-Object System.Collections.Generic.List[string]
$md.Add('# 空间趋势')
$md.Add('')
$md.Add('> 由 `disk-butler` 技能的 `Get-Trend.ps1` 自动生成，**请勿手工编辑**。')
$md.Add(('> 生成于 {0}　·　基于 {1} 份快照' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $snaps.Count))
$md.Add('')

if ($snaps.Count -lt 3) {
    $md.Add(('> ⚠️ 目前只有 **{0}** 份快照，趋势还看不出形状。档案每次刷新会追加一份快照，' -f $snaps.Count))
    $md.Add('> 攒到 3 份以上开始有意义，跨度越大越有价值。')
    $md.Add('')
}

# ---- 表：各盘可用空间逐次变化 ----
$md.Add('## 各盘可用空间（逐次快照）')
$md.Add('')
$hdr = '| 时间 | ' + (($drives | ForEach-Object { "$_ 可用" }) -join ' | ') + ' |'
$sep = '|---' + ('|---' * $drives.Count) + '|'
$md.Add($hdr); $md.Add($sep)

$freeSeries = @{}
foreach ($dv in $drives) { $freeSeries[$dv] = New-Object System.Collections.Generic.List[double] }

foreach ($s in $snaps) {
    $row = '| ' + ([datetime]$s.Time).ToString('MM-dd HH:mm') + ' |'
    foreach ($dv in $drives) {
        $d = $s.Data.disks | Where-Object { $_.Drive -eq $dv } | Select-Object -First 1
        if ($d) {
            $row += (' {0:N1} GB |' -f $d.FreeGB)
            $freeSeries[$dv].Add([double]$d.FreeGB)
        } else { $row += ' — |' }
    }
    $md.Add($row)
}
$md.Add('')

# ---- 迷你趋势图 ----
$md.Add('## 迷你趋势图（越高 = 可用空间越多）')
$md.Add('')
$md.Add('```text')
foreach ($dv in $drives) {
    $vals = @($freeSeries[$dv].ToArray())
    if ($vals.Count -eq 0) { continue }
    $first = $vals[0]; $last = $vals[-1]; $delta = $last - $first
    $sign = if ($delta -gt 0) { '+' } else { '' }
    $md.Add(('{0}  {1}   {2,7:N1} GB → {3,7:N1} GB   ({4}{5:N1} GB)' -f `
        $dv, (Get-Sparkline -Values $vals), $first, $last, $sign, $delta))
}
$md.Add('```')
$md.Add('')

# ---- 涨跌榜：最早 vs 最新（只比都带 dirSizes 的快照）----
$withSizes = @($snaps | Where-Object { $_.Data.dirSizes })
if ($withSizes.Count -ge 2) {
    $oldSnap = $withSizes[0]
    $newSnap = $withSizes[-1]
    $md.Add(('## 涨跌榜（{0} → {1}）' -f `
        ([datetime]$oldSnap.Time).ToString('MM-dd HH:mm'), ([datetime]$newSnap.Time).ToString('MM-dd HH:mm')))
    $md.Add('')
    $md.Add(('只列出变化超过 {0} MB 的目录。' -f $MinChangeMB))
    $md.Add('')

    $deltas = New-Object System.Collections.Generic.List[object]
    foreach ($drv in ($newSnap.Data.dirSizes.PSObject.Properties.Name)) {
        foreach ($cur in $newSnap.Data.dirSizes.$drv) {
            $old = $oldSnap.Data.dirSizes.$drv | Where-Object { $_.Path -eq $cur.Path } | Select-Object -First 1
            if (-not $old) {
                $deltas.Add([pscustomobject]@{ Path = $cur.Path; Delta = [double]$cur.Bytes; IsNew = $true })
                continue
            }
            $dm = ([double]$cur.Bytes - [double]$old.Bytes) / 1MB
            if ([math]::Abs($dm) -ge $MinChangeMB) {
                $deltas.Add([pscustomobject]@{ Path = $cur.Path; Delta = [double]$cur.Bytes - [double]$old.Bytes; IsNew = $false })
            }
        }
        # 消失的目录
        foreach ($old in $oldSnap.Data.dirSizes.$drv) {
            $still = $newSnap.Data.dirSizes.$drv | Where-Object { $_.Path -eq $old.Path } | Select-Object -First 1
            if (-not $still) {
                $deltas.Add([pscustomobject]@{ Path = $old.Path; Delta = -[double]$old.Bytes; IsNew = $false })
            }
        }
    }

    $grew   = @($deltas | Where-Object { $_.Delta -gt 0 } | Sort-Object Delta -Descending | Select-Object -First $Top)
    $shrank = @($deltas | Where-Object { $_.Delta -lt 0 } | Sort-Object Delta | Select-Object -First $Top)

    if ($grew.Count -gt 0) {
        $md.Add('### 长大了')
        $md.Add('')
        $md.Add('| 目录 | 增量 |')
        $md.Add('|---|---|')
        foreach ($g in $grew) {
            $tag = if ($g.IsNew) { '　🆕 新增' } else { '' }
            $md.Add(('| `{0}`{1} | +{2} |' -f $g.Path, $tag, (Format-SizeT $g.Delta)))
        }
        $md.Add('')
    }
    if ($shrank.Count -gt 0) {
        $md.Add('### 变小了')
        $md.Add('')
        $md.Add('| 目录 | 减少 |')
        $md.Add('|---|---|')
        foreach ($s2 in $shrank) {
            $md.Add(('| `{0}` | {1} |' -f $s2.Path, (Format-SizeT ([math]::Abs($s2.Delta)))))
        }
        $md.Add('')
    }
    if ($grew.Count -eq 0 -and $shrank.Count -eq 0) {
        $md.Add('没有超过阈值的体积变化。')
        $md.Add('')
    }
} else {
    $md.Add('## 涨跌榜')
    $md.Add('')
    $md.Add(('需要至少 2 份**带目录体积**的快照才能对比（当前 {0} 份）。' -f $withSizes.Count))
    $md.Add('完整刷新（不带 `-SkipSizes`）才会记录目录体积。')
    $md.Add('')
}

# ---- 与变更日志互链 ----
$md.Add('---')
$md.Add('')
$md.Add('逐次刷新的明细差异（含服务、启动项、计划任务变化）见 [`history\变更日志.md`](../history/变更日志.md)。')
$md.Add('')

$text = ($md -join "`r`n")
if (-not $Quiet) { Write-Host ""; $text | Write-Host }

if (-not $NoWrite) {
    $out = Join-Path $AutoDir '09-空间趋势.md'
    [System.IO.File]::WriteAllText($out, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $Quiet) {
        Write-Host ""
        Write-Host (" 已写入: {0}" -f $out) -ForegroundColor Green
        Write-Host ""
    }
}
