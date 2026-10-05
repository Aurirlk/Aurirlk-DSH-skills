<#
  Fix-Bom.ps1 —— 修正文件编码 BOM（开发工具，不随包发布）
  ------------------------------------------------------------------
  为什么需要它：

    本项目的运行环境是 Windows PowerShell 5.1。它读**无 BOM 的 UTF-8** 文件时
    会按 ANSI(GBK) 解释，中文全变乱码，脚本直接解析失败。所以：

      .ps1        必须**有** UTF-8 BOM
      SKILL.md    必须**没有** BOM（带 BOM 会让 frontmatter 的 startsWith('---') 失效）

    而本仓库用的编辑工具会剥掉 BOM。所以每次用编辑工具改完 .ps1，都要跑一遍这个。

    它只是把 BOM 调成正确的状态，不改动任何其他字节。

  用法：
    .\Fix-Bom.ps1              # 修正整个仓库
    .\Fix-Bom.ps1 -Check       # 只检查不修改；有问题时退出码 1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$BOM = [byte[]](0xEF, 0xBB, 0xBF)

function Test-HasBom {
    param([string]$Path)
    $b = [System.IO.File]::ReadAllBytes($Path)
    return ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
}

function Add-Bom {
    param([string]$Path)
    $b = [System.IO.File]::ReadAllBytes($Path)
    [System.IO.File]::WriteAllBytes($Path, $BOM + $b)
}

function Remove-Bom {
    param([string]$Path)
    $b = [System.IO.File]::ReadAllBytes($Path)
    [System.IO.File]::WriteAllBytes($Path, $b[3..($b.Length - 1)])
}

$fixed = 0
$problems = 0

Write-Host ("扫描: {0}" -f $RepoRoot) -ForegroundColor Cyan

# ---- .ps1 必须有 BOM ----
$ps1 = @(Get-ChildItem $RepoRoot -Recurse -Filter '*.ps1' -File -ErrorAction SilentlyContinue |
         Where-Object { $_.FullName -notmatch '\\node_modules\\' })
foreach ($f in $ps1) {
    $rel = $f.FullName.Replace($RepoRoot + '\', '')
    if (Test-HasBom $f.FullName) {
        Write-Host ("  ✅ {0}" -f $rel) -ForegroundColor DarkGray
    } else {
        $problems++
        if ($Check) {
            Write-Host ("  ❌ {0}  缺 UTF-8 BOM" -f $rel) -ForegroundColor Red
        } else {
            Add-Bom $f.FullName
            Write-Host ("  🔧 {0}  已补 BOM" -f $rel) -ForegroundColor Yellow
            $fixed++
        }
    }
}

# ---- SKILL.md 必须没有 BOM ----
$skills = @(Get-ChildItem $RepoRoot -Recurse -Filter 'SKILL.md' -File -ErrorAction SilentlyContinue)
foreach ($f in $skills) {
    $rel = $f.FullName.Replace($RepoRoot + '\', '')
    if (-not (Test-HasBom $f.FullName)) {
        Write-Host ("  ✅ {0}  无 BOM（正确）" -f $rel) -ForegroundColor DarkGray
    } else {
        $problems++
        if ($Check) {
            Write-Host ("  ❌ {0}  不该有 BOM（会让 frontmatter 解析失效）" -f $rel) -ForegroundColor Red
        } else {
            Remove-Bom $f.FullName
            Write-Host ("  🔧 {0}  已去 BOM" -f $rel) -ForegroundColor Yellow
            $fixed++
        }
    }
}

Write-Host ""
if ($Check) {
    if ($problems -eq 0) { Write-Host " 全部正确，无需修正。" -ForegroundColor Green; exit 0 }
    Write-Host (" 发现 {0} 处 BOM 问题。运行不带 -Check 的 Fix-Bom.ps1 修正。" -f $problems) -ForegroundColor Red
    exit 1
} else {
    Write-Host (" 修正 {0} 处（检查了 {1} 个 .ps1 与 {2} 个 SKILL.md）。" -f $fixed, $ps1.Count, $skills.Count) -ForegroundColor Green
    if ($fixed -gt 0) {
        Write-Host " 建议接着跑： .\skills\disk-butler\scripts\Test-SkillHealth.ps1 -Deep" -ForegroundColor Cyan
    }
    exit 0
}
