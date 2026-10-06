<#
  Export-Drawio.ps1 —— 逐页导出 draw.io 图表（PNG / SVG / PDF / JPG）
  ------------------------------------------------------------------
  为什么需要它：

    draw.io 的 CLI 有三个**不报错但给你错东西**的坑（本机 30.2.4 实测）：

      1. --page-index 是 1-based。传 0 不报错，静默回落到第 1 页。
         所以"从 0 开始循环"会安静地导出 N 份第 1 页。
      2. --all-pages 配 PNG 无效，只出第 1 页。多页必须自己循环。
      3. 它是 Electron 程序，进程退出不等于文件写完；连续调用时
         第二次可能被第一次没退干净的实例吞掉。

    这个脚本把三条都封掉了，并且**自动核对导出结果的哈希**——
    如果有两页产出字节完全相同，那几乎一定是踩了坑 1 或坑 3，会告警。

  用法：
    .\Export-Drawio.ps1 -Path .\架构.drawio -OutDir .\out -Format png -Scale 2
    .\Export-Drawio.ps1 -Path .\架构.drawio -Pages 2
    .\Export-Drawio.ps1 -Path .\架构.drawio -Format svg -AllPages
    .\Export-Drawio.ps1 -Path .\架构.drawio -ListPages
    .\Export-Drawio.ps1 -Path .\架构.drawio -OutDir .\out -UsePageName
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Path,

    [string]$OutDir,

    [ValidateSet('png', 'svg', 'pdf', 'jpg')]
    [string]$Format = 'png',

    [int]$Scale = 2,
    [int]$Border = 10,

    [int[]]$Pages,
    [switch]$AllPages,
    [switch]$UsePageName,
    [switch]$ListPages,
    [switch]$Transparent,

    [string]$DrawioPath,
    [int]$TimeoutSec = 90
)

$ErrorActionPreference = 'Stop'

# ---------- 工具函数 ----------

function Find-DrawioExe {
    <#
      探测顺序（第 4 条最关键——本机 InstallLocation 是空的）：
        1. App Paths 注册
        2. PATH
        3. 注册表 InstallLocation
        4. 注册表 DisplayIcon（末尾有 ,0 图标索引，必须剥掉）
        5. 常见安装路径兜底
    #>
    $cands = New-Object System.Collections.Generic.List[string]

    $ap = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\draw.io.exe'
    if (Test-Path $ap) {
        $v = (Get-ItemProperty -Path $ap -ErrorAction SilentlyContinue).'(default)'
        if ($v) { $cands.Add($v) }
    }

    foreach ($n in @('drawio', 'draw.io')) {
        $g = Get-Command $n -ErrorAction SilentlyContinue
        if ($g -and $g.Source) { $cands.Add($g.Source) }
    }

    $keys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $apps = Get-ItemProperty $keys -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -match 'draw\.io|diagrams\.net' }
    foreach ($a in $apps) {
        if ($a.InstallLocation) { $cands.Add((Join-Path $a.InstallLocation 'draw.io.exe')) }
        if ($a.DisplayIcon) {
            # ",0" 是图标索引，不是路径的一部分
            $cands.Add(($a.DisplayIcon -replace ',\d+$', '').Trim('"'))
        }
    }

    foreach ($p in @(
        "$env:ProgramFiles\draw.io\draw.io.exe",
        "${env:ProgramFiles(x86)}\draw.io\draw.io.exe",
        "$env:ProgramFiles\Draw.io\draw.io.exe",
        "${env:ProgramFiles(x86)}\Draw.io\draw.io.exe",
        "$env:LOCALAPPDATA\Programs\draw.io\draw.io.exe",
        'D:\Program Files\draw.io\draw.io.exe',
        'D:\Program Files\Draw.io\draw.io.exe'
    )) { $cands.Add($p) }

    foreach ($c in $cands) {
        if ($c -and (Test-Path -LiteralPath $c -PathType Leaf)) { return $c }
    }
    return $null
}

function Get-DrawioPage {
    param([string]$File)
    $raw = [System.IO.File]::ReadAllText($File, [System.Text.Encoding]::UTF8)
    $doc = New-Object System.Xml.XmlDocument
    $doc.LoadXml($raw)
    $nodes = @($doc.SelectNodes('/mxfile/diagram'))
    if ($nodes.Count -eq 0) { throw "不是有效的 .drawio 文件（找不到 /mxfile/diagram）：$File" }
    $out = New-Object System.Collections.Generic.List[object]
    $i = 0
    foreach ($n in $nodes) {
        $i++
        $name = $n.GetAttribute('name')
        if (-not $name) { $name = "page$i" }
        $isCompressed = -not ($n.SelectSingleNode('mxGraphModel'))
        $out.Add([pscustomobject]@{
            Index      = $i
            Id         = $n.GetAttribute('id')
            Name       = $name
            Compressed = $isCompressed
        })
    }
    return $out
}

function Get-SafeFileName {
    param([string]$Name)
    if (-not $Name) { return 'page' }
    $invalid = [System.IO.Path]::GetInvalidFileNameChars()
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $Name.ToCharArray()) {
        if ($invalid -contains $ch) { [void]$sb.Append('_') } else { [void]$sb.Append($ch) }
    }
    $s = $sb.ToString().Trim().TrimEnd('.')
    if (-not $s) { $s = 'page' }
    return $s
}

function Quote-Arg {
    # Start-Process 的 -ArgumentList 对含空格的参数处理很差，自己加引号最稳
    param([string]$A)
    if ($A -match '[\s"]') { return '"' + ($A -replace '"', '\"') + '"' }
    return $A
}

function Invoke-OneExport {
    param(
        [string]$Exe, [string]$Src, [string]$OutFile,
        [string]$Format, [int]$Scale, [int]$Border,
        [int]$PageIndex, [bool]$AllPages, [bool]$Transparent, [int]$TimeoutSec
    )
    $a = New-Object System.Collections.Generic.List[string]
    $a.Add('--export')
    $a.Add('--format'); $a.Add($Format)
    if ($Format -eq 'png' -or $Format -eq 'jpg') {
        $a.Add('--scale');  $a.Add("$Scale")
        $a.Add('--border'); $a.Add("$Border")
        if ($Transparent) { $a.Add('--transparent') }
    }
    if (-not $AllPages) { $a.Add('--page-index'); $a.Add("$PageIndex") }
    $a.Add('--output'); $a.Add($OutFile)
    $a.Add($Src)

    $argStr = (($a | ForEach-Object { Quote-Arg $_ }) -join ' ')

    $pr = Start-Process -FilePath $Exe -ArgumentList $argStr -Wait -PassThru -WindowStyle Hidden
    $code = $pr.ExitCode

    # 第二道保险：轮询等文件落盘，并且等大小稳定（防止读到写了一半的文件）
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path -LiteralPath $OutFile) {
            $s1 = (Get-Item -LiteralPath $OutFile).Length
            Start-Sleep -Milliseconds 350
            if (Test-Path -LiteralPath $OutFile) {
                $s2 = (Get-Item -LiteralPath $OutFile).Length
                if ($s1 -eq $s2 -and $s1 -gt 0) { return $code }
            }
        }
        Start-Sleep -Milliseconds 300
    }
    return -1
}

# ---------- 主流程 ----------

$src = (Resolve-Path -LiteralPath $Path).Path
if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { Write-Error "文件不存在：$src"; exit 1 }

# 必须用 @() 包住函数返回值。Get-DrawioPage 返回的是 List，而 PowerShell 在 return 时
# 会把 List 拆成一个个对象——只有一页时你拿到的是**裸的 PSCustomObject**，它的 .Count 是空。
# 于是下面的 `1..$pageCount` 会退化成 `1..$null`，在 PowerShell 里等于 `1,0`（降序两元素），
# 页号校验随即报出莫名其妙的「页号超出范围：1,0」。单页文件必踩，多页文件不踩。
$diagrams = @(Get-DrawioPage -File $src)
$pageCount = $diagrams.Count
if ($pageCount -lt 1) {
    Write-Host ("解析不出任何页（文件可能不是有效的 .drawio）：{0}" -f $src) -ForegroundColor Red
    exit 1
}
$baseName  = [System.IO.Path]::GetFileNameWithoutExtension($src)

if ($ListPages) {
    if (-not $DrawioPath) { $DrawioPath = Find-DrawioExe }
    Write-Host ""
    Write-Host ("文件    : {0}" -f $src) -ForegroundColor Cyan
    Write-Host ("页数    : {0}" -f $pageCount) -ForegroundColor Cyan
    Write-Host ("drawio  : {0}" -f $(if ($DrawioPath) { $DrawioPath } else { '(未找到 —— 只能生成和体检，不能导出)' })) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Index  Id            Name                      压缩"
    Write-Host "  -----  ------------  ------------------------  ----"
    foreach ($d in $diagrams) {
        Write-Host ("  {0,-5}  {1,-12}  {2,-24}  {3}" -f $d.Index, $d.Id, $d.Name, $(if ($d.Compressed) { '是' } else { '否' }))
    }
    Write-Host ""
    Write-Host "  注意：导出时 --page-index 用上面的 Index（1-based）。传 0 会静默回落到第 1 页。" -ForegroundColor Yellow
    exit 0
}

if (-not $DrawioPath) { $DrawioPath = Find-DrawioExe }
if (-not $DrawioPath) {
    Write-Host "找不到 draw.io 桌面版，无法导出。" -ForegroundColor Red
    Write-Host "  装一个：winget install JGraph.Draw" -ForegroundColor Yellow
    Write-Host "  或手动指定： -DrawioPath 'D:\Program Files\Draw.io\draw.io.exe'" -ForegroundColor Yellow
    Write-Host "  （生成 .drawio 和布局体检不需要 draw.io，那两个脚本照样能用）" -ForegroundColor DarkGray
    exit 1
}

if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $src) 'export' }
if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}
$OutDir = (Resolve-Path -LiteralPath $OutDir).Path

$done = New-Object System.Collections.Generic.List[object]

# SVG + AllPages：SVG 支持多页写进一个文件，这条路是通的
if ($Format -eq 'svg' -and $AllPages) {
    $outFile = Join-Path $OutDir "$baseName.svg"
    Write-Host ("导出 SVG（全部 {0} 页 → 1 个文件）…" -f $pageCount) -ForegroundColor Cyan
    $code = Invoke-OneExport -Exe $DrawioPath -Src $src -OutFile $outFile -Format $Format `
        -Scale $Scale -Border $Border -PageIndex 1 -AllPages $true `
        -Transparent:$Transparent -TimeoutSec $TimeoutSec
    if ($code -eq -1) {
        Write-Host "  失败：等待超时，文件没落盘" -ForegroundColor Red
        exit 1
    }
    $len = (Get-Item -LiteralPath $outFile).Length
    Write-Host ("  OK  {0}  {1:N0} bytes" -f (Split-Path -Leaf $outFile), $len) -ForegroundColor Green
    exit 0
}

# 其余情况逐页导出
$targets = if ($Pages) { $Pages } else { 1..$pageCount }

$bad = @($targets | Where-Object { $_ -lt 1 -or $_ -gt $pageCount })
if ($bad.Count -gt 0) {
    Write-Host ("页号超出范围：{0}（本文件共 {1} 页，合法范围 1..{1}）" -f ($bad -join ','), $pageCount) -ForegroundColor Red
    exit 1
}

Write-Host ("导出 {0} —— 共 {1} 页，本次导 {2} 页，格式 {3}" -f $baseName, $pageCount, $targets.Count, $Format.ToUpper()) -ForegroundColor Cyan
Write-Host ("  drawio : {0}" -f $DrawioPath) -ForegroundColor DarkGray
Write-Host ("  输出   : {0}" -f $OutDir) -ForegroundColor DarkGray
Write-Host ""

foreach ($idx in $targets) {
    $info = $diagrams[$idx - 1]
    if ($UsePageName) {
        $leaf = "{0}-p{1}-{2}.{3}" -f $baseName, $idx, (Get-SafeFileName $info.Name), $Format
    } else {
        $leaf = "{0}-p{1}.{2}" -f $baseName, $idx, $Format
    }
    $outFile = Join-Path $OutDir $leaf

    Write-Host ("  [{0}/{1}] page-index={2}  {3}" -f $idx, $pageCount, $idx, $info.Name) -NoNewline
    # 每页隔离：先删掉旧产物，避免把上一轮的文件当成这次的结果
    if (Test-Path -LiteralPath $outFile) { Remove-Item -LiteralPath $outFile -Force }

    $code = Invoke-OneExport -Exe $DrawioPath -Src $src -OutFile $outFile -Format $Format `
        -Scale $Scale -Border $Border -PageIndex $idx -AllPages $false `
        -Transparent:$Transparent -TimeoutSec $TimeoutSec

    if ($code -eq -1 -or -not (Test-Path -LiteralPath $outFile)) {
        Write-Host "  → 失败（超时或未产出）" -ForegroundColor Red
        continue
    }
    $fi = Get-Item -LiteralPath $outFile
    $hash = (Get-FileHash -LiteralPath $outFile -Algorithm SHA256).Hash
    $done.Add([pscustomobject]@{
        Index = $idx; Name = $info.Name; Leaf = $leaf
        Bytes = $fi.Length; Hash = $hash
    })
    Write-Host ("  → {0:N0} bytes" -f $fi.Length) -ForegroundColor Green
}

Write-Host ""

# ---------- 自检：两页产出完全相同 = 踩坑了 ----------
if ($done.Count -gt 1) {
    $groups = $done | Group-Object Hash | Where-Object { $_.Count -gt 1 }
    if ($groups) {
        Write-Host "!! 告警：下列页导出的字节完全相同，内容极可能不是各自的页。" -ForegroundColor Red
        Write-Host "   最常见原因：--page-index 传了 0（会静默回落到第 1 页），或 Electron 实例互相干扰。" -ForegroundColor Red
        foreach ($g in $groups) {
            $idxList = ($g.Group | ForEach-Object { $_.Index }) -join ', '
            Write-Host ("   hash {0}… 来自页 {1}" -f $g.Name.Substring(0, 12), $idxList) -ForegroundColor Red
        }
        Write-Host "   请打开这些文件肉眼确认。" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
}

Write-Host ("完成：{0} 个文件 → {1}" -f $done.Count, $OutDir) -ForegroundColor Green
exit 0
