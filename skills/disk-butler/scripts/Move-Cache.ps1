<#
  Move-Cache.ps1 —— 把缓存目录迁到别的盘，原地留一个 Junction
  ------------------------------------------------------------------
  原理：把目录整体搬到目标盘，然后在原位置建一个 NTFS Junction 指过去。
  对应用程序完全透明 —— 它仍然按老路径读写，数据实际落在新盘。

  为什么用 Junction 而不是改配置：
    * 很多软件的缓存路径是写死或用注册表存的，改不动
    * Junction 不需要改任何配置，也不占额外空间
    * 创建 Junction（mklink /J）**不需要管理员权限**（符号链接才需要）

  怎么用：
    # 预演
    .\Move-Cache.ps1 -Source "$env:USERPROFILE\.cache\puppeteer" -Destination "E:\Cache\puppeteer"

    # 真做
    .\Move-Cache.ps1 -Source "..." -Destination "..." -Execute

    # 看已迁移的记录
    .\Move-Cache.ps1 -List

    # 回退某次迁移
    .\Move-Cache.ps1 -Rollback -Manifest "..\logs\junction-20261004-....json"
#>
[CmdletBinding(DefaultParameterSetName='Move')]
param(
    [Parameter(ParameterSetName='Move', Mandatory=$true)][string]$Source,
    [Parameter(ParameterSetName='Move', Mandatory=$true)][string]$Destination,
    [Parameter(ParameterSetName='Move')][switch]$Execute,
    [Parameter(ParameterSetName='Move')][switch]$Move,          # 兼容旧写法，等同 -Execute

    [Parameter(ParameterSetName='List', Mandatory=$true)][switch]$List,
    [Parameter(ParameterSetName='Rollback', Mandatory=$true)][switch]$Rollback,
    [Parameter(ParameterSetName='Rollback', Mandatory=$true)][string]$Manifest,

    [switch]$Force
)

$ErrorActionPreference = 'Continue'
# 迁移记录写到用户数据目录，不写进技能目录——技能目录是共享只读资源
$RecBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $env:TEMP }
$RecDir = Join-Path $RecBase 'disk-butler\junctions'
if (-not (Test-Path $RecDir)) { New-Item -ItemType Directory -Path $RecDir -Force | Out-Null }

function Format-Size4 {
    param([double]$B)
    if ($B -ge 1GB) { return ('{0:N2} GB' -f ($B/1GB)) }
    if ($B -ge 1MB) { return ('{0:N1} MB' -f ($B/1MB)) }
    if ($B -ge 1KB) { return ('{0:N1} KB' -f ($B/1KB)) }
    return ('{0} B' -f [int]$B)
}

function Get-TreeStat {
    param([string]$Path)
    $b = 0L; $c = 0
    try {
        $stack = New-Object System.Collections.Generic.Stack[string]
        $stack.Push($Path)
        while ($stack.Count -gt 0) {
            $cur = $stack.Pop()
            try { foreach ($f in [System.IO.Directory]::EnumerateFiles($cur)) { try { $b += ([System.IO.FileInfo]$f).Length; $c++ } catch {} } } catch {}
            try { foreach ($d in [System.IO.Directory]::EnumerateDirectories($cur)) { $stack.Push($d) } } catch {}
        }
    } catch { }
    return [pscustomobject]@{ Bytes = $b; Count = $c }
}

function Test-IsJunction {
    param([string]$Path)
    try { return ([System.IO.FileAttributes]::ReparsePoint -band (Get-Item -LiteralPath $Path -Force).Attributes) -ne 0 }
    catch { return $false }
}

# ================================================================ -List
if ($List) {
    $mans = Get-ChildItem $RecDir -Filter 'junction-*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    Write-Host ""
    Write-Host "================ 已记录的缓存迁移 ================" -ForegroundColor Cyan
    if (-not $mans) { Write-Host " （没有记录）" -ForegroundColor DarkGray }
    foreach ($m in $mans) {
        $j = Get-Content $m.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $alive = if (Test-Path -LiteralPath $j.source) { if (Test-IsJunction $j.source) { '✅ Junction 有效' } else { '⚠️ 原位置已不是 Junction' } } else { '❌ 原位置不存在' }
        Write-Host (" {0}" -f $j.source)
        Write-Host ("    → {0}" -f $j.destination) -ForegroundColor DarkGray
        Write-Host ("    {0}  |  {1} 个文件 {2}  |  {3}" -f $alive, $j.fileCount, (Format-Size4 $j.bytes), $j.movedAt) -ForegroundColor DarkGray
        Write-Host ("    记录: {0}" -f $m.Name) -ForegroundColor DarkGray
    }
    Write-Host ""
    exit 0
}

# ================================================================ -Rollback
if ($Rollback) {
    if (-not (Test-Path -LiteralPath $Manifest)) { throw "找不到迁移记录: $Manifest" }
    $j = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host ""
    Write-Host "================ 回退缓存迁移 ================" -ForegroundColor Cyan
    Write-Host (" 原位置 : {0}" -f $j.source)
    Write-Host (" 数据在 : {0}" -f $j.destination)
    Write-Host ""

    if (-not (Test-IsJunction $j.source)) {
        Write-Host " 原位置不是 Junction，无需回退（或已回退过）。" -ForegroundColor Yellow
        exit 1
    }
    # 1) 删掉 Junction（只删链接，不动目标数据）
    Remove-Item -LiteralPath $j.source -Force -ErrorAction Stop
    Write-Host " [1/3] 已删除 Junction" -ForegroundColor Green
    # 2) 把数据搬回来
    $null = robocopy $j.destination $j.source /E /MOVE /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -ge 8) { Write-Host (" [2/3] 搬回失败，robocopy 退出码 {0}，数据仍在 {1}" -f $LASTEXITCODE, $j.destination) -ForegroundColor Red; exit 1 }
    Write-Host " [2/3] 数据已搬回" -ForegroundColor Green
    # 3) 清理空的目标目录
    if ((Test-Path -LiteralPath $j.destination) -and -not (Get-ChildItem -LiteralPath $j.destination -Force -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath $j.destination -Force -ErrorAction SilentlyContinue
    }
    Write-Host " [3/3] 完成" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# ================================================================ 迁移
Write-Host ""
Write-Host "================ 缓存迁移（Junction） ================" -ForegroundColor Cyan
Write-Host (" 源   : {0}" -f $Source)
Write-Host (" 目标 : {0}" -f $Destination)
Write-Host (" 模式 : {0}" -f $(if ($Execute -or $Move) { '真迁移' } else { '预演' }))
Write-Host ""

# ---- 校验 ----
if (-not (Test-Path -LiteralPath $Source)) { throw "源目录不存在: $Source" }
if (Test-IsJunction $Source) { throw "源目录已经是一个 Junction/链接，不要重复迁移" }

$srcItem = Get-Item -LiteralPath $Source -Force
$srcRoot = $srcItem.PSDrive.Name
$dstRoot = (Split-Path -Qualifier $Destination).TrimEnd(':')
if ($srcRoot -eq $dstRoot) {
    Write-Host " ⚠️  源和目标在同一个盘，迁移没有意义（不释放任何空间）。" -ForegroundColor Yellow
    if (-not $Force) { Write-Host "     确认要继续请加 -Force。" -ForegroundColor Yellow; exit 1 }
}

# 备份子目录拦截（这次就是这样发现 WPS 文档备份的）
$bk = $null
try {
    $stack = New-Object System.Collections.Generic.Stack[object]
    $stack.Push(@{ P = $Source; D = 0 })
    while ($stack.Count -gt 0) {
        $cur = $stack.Pop(); if ($cur.D -ge 3) { continue }
        foreach ($d in [System.IO.Directory]::EnumerateDirectories($cur.P)) {
            if ((Split-Path $d -Leaf) -match '^(backup|backups|recover|recovery|restore|备份|恢复|autosave)$') { $bk = $d; break }
            $stack.Push(@{ P = $d; D = $cur.D + 1 })
        }
        if ($bk) { break }
    }
} catch { }
if ($bk -and -not $Force) {
    Write-Host (" 🔴 源目录内含备份/恢复类子目录：{0}" -f $bk) -ForegroundColor Red
    Write-Host "     迁移整个目录会把这些数据一起搬走。确认无碍请加 -Force。" -ForegroundColor Red
    exit 1
}

if (Test-Path -LiteralPath $Destination) {
    $d = Get-ChildItem -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
    if ($d) { throw "目标目录已存在且非空: $Destination" }
}

$stat = Get-TreeStat -Path $Source
Write-Host (" 源目录体积: {0}  （{1} 个文件）" -f (Format-Size4 $stat.Bytes), $stat.Count) -ForegroundColor Gray
$dstDisk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($dstRoot):'"
Write-Host (" 目标盘可用: {0:N1} GB" -f ($dstDisk.FreeSpace/1GB)) -ForegroundColor Gray
if ($stat.Bytes -gt $dstDisk.FreeSpace) { throw "目标盘空间不足" }
Write-Host ""

if (-not ($Execute -or $Move)) {
    Write-Host " 预演完成，未做任何改动。确认后加 -Execute 真正执行。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host " 执行时会做：robocopy 搬到目标 → 校验文件数与字节数 → 删源 → 建 Junction → 校验 Junction 可解析" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

# ---- 执行 ----
$parent = Split-Path $Destination -Parent
if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

Write-Host " [1/5] 复制到目标 ..." -ForegroundColor Yellow
$null = robocopy $Source $Destination /E /COPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy 失败，退出码 $LASTEXITCODE。源目录未改动，可放心重试。" }
Write-Host "       完成" -ForegroundColor Green

Write-Host " [2/5] 校验 ..." -ForegroundColor Yellow
$dstStat = Get-TreeStat -Path $Destination
if ($dstStat.Count -ne $stat.Count -or $dstStat.Bytes -ne $stat.Bytes) {
    throw ("校验失败：源 {0} 文件/{1}，目标 {2} 文件/{3}。已中止，源目录未改动。" -f `
        $stat.Count, (Format-Size4 $stat.Bytes), $dstStat.Count, (Format-Size4 $dstStat.Bytes))
}
Write-Host ("       一致：{0} 个文件，{1}" -f $stat.Count, (Format-Size4 $stat.Bytes)) -ForegroundColor Green

Write-Host " [3/5] 删除源目录 ..." -ForegroundColor Yellow
try { Remove-Item -LiteralPath $Source -Recurse -Force -ErrorAction Stop }
catch {
    Write-Host ("       删除失败：{0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host ("       数据已安全复制到 {0}，但源目录还在（可能有程序占用）。" -f $Destination) -ForegroundColor Yellow
    Write-Host "       关掉相关程序后手动删除源目录，再执行：New-Item -ItemType Junction -Path '<源>' -Target '<目标>'" -ForegroundColor Yellow
    exit 1
}
Write-Host "       完成" -ForegroundColor Green

Write-Host " [4/5] 建立 Junction ..." -ForegroundColor Yellow
try {
    New-Item -ItemType Junction -Path $Source -Target $Destination -ErrorAction Stop | Out-Null
} catch {
    $msg = ("建立 Junction 失败：{0}`n数据已安全保存在 {1}，请手动执行：`n  New-Item -ItemType Junction -Path '{2}' -Target '{3}'" -f `
        $_.Exception.Message, $Destination, $Source, $Destination)
    throw $msg
}
Write-Host "       完成" -ForegroundColor Green

Write-Host " [5/5] 校验 Junction ..." -ForegroundColor Yellow
$chk = Get-ChildItem -LiteralPath $Source -Force -ErrorAction SilentlyContinue
if (-not $chk) { throw "Junction 建好了但读不到内容，请手动检查 $Source" }
Write-Host ("       可正常读取（{0} 个顶层项）" -f @($chk).Count) -ForegroundColor Green

# ---- 记录，供回退 ----
$manifest = Join-Path $RecDir ("junction-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
[pscustomobject]@{
    schemaVersion = 1
    source        = (Resolve-Path -LiteralPath $Source).Path
    destination   = (Resolve-Path -LiteralPath $Destination).Path
    movedAt       = (Get-Date).ToString('o')
    fileCount     = $stat.Count
    bytes         = $stat.Bytes
} | ConvertTo-Json | Set-Content -LiteralPath $manifest -Encoding UTF8

Write-Host ""
Write-Host " ================ 完成 ================" -ForegroundColor Cyan
Write-Host ("  {0}" -f $Source) -ForegroundColor White
Write-Host ("     → {0}" -f $Destination) -ForegroundColor DarkGray
Write-Host ("  释放原盘空间: {0}" -f (Format-Size4 $stat.Bytes)) -ForegroundColor Green
Write-Host ("  回退记录    : {0}" -f $manifest) -ForegroundColor Gray
Write-Host ""
Write-Host ("  回退命令: .\Move-Cache.ps1 -Rollback -Manifest `"{0}`"" -f $manifest) -ForegroundColor Gray
Write-Host ""
