<#
  Get-Drilldown.ps1 —— 目录下钻：一层层找出"空间到底被谁吃了"
  ------------------------------------------------------------------
  回答的是最常见也最难查的那个问题：「C:\Users 占了 55 GB，里面到底是什么？」

  做法：对目标目录做**一次**完整遍历，把每个目录的直接文件字节数记下来，
  再自底向上汇总成子树总量，最后按层取 Top-N 打印。复杂度是 O(数据量)，
  不会因为"每层重扫一遍"而变成 O(数据量 × 层数)。

  用法：
    # 看 C:\Users 里最大的 10 个，往下钻 2 层
    .\Get-Drilldown.ps1 -Path C:\Users

    # 钻深一点，只看大于 200 MB 的
    .\Get-Drilldown.ps1 -Path C:\Users -Depth 4 -MinSizeMB 200

    # 存成 markdown（可放进本机档案）
    .\Get-Drilldown.ps1 -Path D:\ -Top 15 -MarkdownOut "$env:TEMP\drilldown.md"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Path,

    # 每层最多显示几个
    [int]$Top = 10,

    # 往下钻几层（1 = 只看目标的直接子目录）
    [int]$Depth = 3,

    # 小于这个体积的不显示（MB）
    [int]$MinSizeMB = 50,

    # 输出 markdown 文件
    [string]$MarkdownOut,

    # 同时统计文件数
    [switch]$WithCount
)

$ErrorActionPreference = 'Continue'

if (-not (Test-Path -LiteralPath $Path)) { throw "路径不存在: $Path" }
$root = (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\')
$minBytes = [double]$MinSizeMB * 1MB

function Format-SizeD {
    param([double]$B)
    if ($B -ge 1TB) { return ('{0:N2} TB' -f ($B/1TB)) }
    if ($B -ge 1GB) { return ('{0:N2} GB' -f ($B/1GB)) }
    if ($B -ge 1MB) { return ('{0:N1} MB' -f ($B/1MB)) }
    if ($B -ge 1KB) { return ('{0:N1} KB' -f ($B/1KB)) }
    return ('{0} B' -f [int]$B)
}

# ============================================================ 单次遍历
Write-Host ""
Write-Host "================ 目录下钻 ================" -ForegroundColor Cyan
Write-Host (" 目标 : {0}" -f $root)
Write-Host (" 层数 : {0}    每层 Top {1}    最小 {2} MB" -f $Depth, $Top, $MinSizeMB)
Write-Host ""
Write-Host " 正在遍历（只扫一遍，请稍候）..." -ForegroundColor DarkGray

$sw = [System.Diagnostics.Stopwatch]::StartNew()

$direct   = @{}   # 目录 -> 直属文件的字节数
$files    = @{}   # 目录 -> 直属文件数
$parent   = @{}   # 子目录 -> 父目录
$children = @{}   # 目录 -> 子目录列表

$stack = New-Object System.Collections.Generic.Stack[string]
$stack.Push($root)
$direct[$root] = 0L; $files[$root] = 0
$children[$root] = New-Object System.Collections.Generic.List[string]

$dirCount = 0
while ($stack.Count -gt 0) {
    $cur = $stack.Pop()
    $dirCount++
    if ($dirCount % 2000 -eq 0) {
        Write-Host ("    ...已遍历 {0} 个目录" -f $dirCount) -ForegroundColor DarkGray
    }

    $sum = 0L; $cnt = 0
    try {
        # 用 DirectoryInfo.EnumerateFiles()：它返回的 FileInfo 已带 Length
        # （底层 FindFirstFile/FindNextFile 本来就返回大小），省掉每个文件一次 stat
        try {
            $di = New-Object System.IO.DirectoryInfo $cur
            foreach ($fi in $di.EnumerateFiles()) {
                try { $sum += $fi.Length; $cnt++ } catch { }
            }
        } catch { }
    } catch { }
    $direct[$cur] = $sum
    $files[$cur]  = $cnt
    if (-not $children.ContainsKey($cur)) { $children[$cur] = New-Object System.Collections.Generic.List[string] }

    try {
        foreach ($d in [System.IO.Directory]::EnumerateDirectories($cur)) {
            $children[$cur].Add($d)
            $parent[$d]   = $cur
            $direct[$d]   = 0L
            $files[$d]    = 0
            $children[$d] = New-Object System.Collections.Generic.List[string]
            $stack.Push($d)
        }
    } catch { }
}

$sw.Stop()
Write-Host (" 遍历完成：{0} 个目录，耗时 {1:N1} 秒" -f $dirCount, $sw.Elapsed.TotalSeconds) -ForegroundColor DarkGray

# ============================================================ 自底向上汇总
# 子目录的路径一定比父目录长，所以按"路径深度降序"处理即可保证先子后父
$total = @{}
foreach ($k in $direct.Keys) { $total[$k] = $direct[$k] }
$totalFiles = @{}
foreach ($k in $files.Keys) { $totalFiles[$k] = $files[$k] }

$byDepth = $total.Keys | Sort-Object { ($_ -split '\\').Count } -Descending
foreach ($k in $byDepth) {
    $p = $parent[$k]
    if ($p -and $total.ContainsKey($p)) {
        $total[$p] += $total[$k]
        $totalFiles[$p] += $totalFiles[$k]
    }
}

$rootTotal = $total[$root]
$rootFiles = $totalFiles[$root]

# ============================================================ 渲染
$lines = New-Object System.Collections.Generic.List[string]

function Get-Kids {
    param([string]$Dir)
    $children[$Dir] |
        Where-Object { $total[$_] -ge $minBytes } |
        Sort-Object { $total[$_] } -Descending |
        Select-Object -First $Top
}

function Emit-Node {
    param([string]$Dir, [string]$Prefix, [int]$Level)
    if ($Level -gt $Depth) { return }
    $kids = @(Get-Kids -Dir $Dir)
    for ($i = 0; $i -lt $kids.Count; $i++) {
        $k = $kids[$i]
        $last = ($i -eq $kids.Count - 1)
        $branch = if ($last) { '└─ ' } else { '├─ ' }
        $share = if ($rootTotal -gt 0) { [math]::Round($total[$k] / $rootTotal * 100, 1) } else { 0 }
        $name = Split-Path $k -Leaf
        if (-not $name) { $name = $k }   # 盘根这种没有 Leaf 的情况

        $cntTxt = if ($WithCount) { ('  {0:N0} 文件' -f $totalFiles[$k]) } else { '' }
        $lines.Add(("{0}{1}{2,10}  {3,5}%  {4}{5}" -f $Prefix, $branch, (Format-SizeD $total[$k]), $share, $name, $cntTxt))

        # 子节点的前缀：父节点是最后一个 -> 留空；否则补一条竖线保持对齐
        $childPrefix = $Prefix + $(if ($last) { '   ' } else { '│  ' })
        Emit-Node -Dir $k -Prefix $childPrefix -Level ($Level + 1)
    }
}

$lines.Add(("{0}  ({1}{2})" -f $root, (Format-SizeD $rootTotal),
    $(if ($WithCount) { ", {0:N0} 个文件" -f $rootFiles } else { "" })))
Emit-Node -Dir $root -Prefix "" -Level 1

Write-Host ""
$lines | ForEach-Object { Write-Host $_ }

# 占比对不上时给出解释（和档案里的体积页同一个道理）
$parentPath = Split-Path $root -Parent
if ($parentPath) {
    Write-Host ""
    Write-Host (" 提示：本目录 {0}；若与其父目录下的其他内容对不上账，通常是受系统保护的" -f (Format-SizeD $rootTotal)) -ForegroundColor DarkGray
    Write-Host "       System Volume Information（还原点/卷影副本）在普通权限下枚举为 0 B。" -ForegroundColor DarkGray
}

if ($MarkdownOut) {
    $md = New-Object System.Collections.Generic.List[string]
    $md.Add("# 目录下钻：$root")
    $md.Add("")
    $md.Add(("> 生成于 {0}　·　层数 {1}　·　每层 Top {2}　·　最小 {3} MB　·　共 {4} 个目录" -f `
        (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Depth, $Top, $MinSizeMB, $dirCount))
    $md.Add("")
    $md.Add('```text')
    foreach ($l in $lines) { $md.Add($l) }
    $md.Add('```')
    $md.Add("")
    [System.IO.File]::WriteAllText($MarkdownOut, ($md -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
    Write-Host ""
    Write-Host (" 已写入: {0}" -f $MarkdownOut) -ForegroundColor Green
}

Write-Host ""
