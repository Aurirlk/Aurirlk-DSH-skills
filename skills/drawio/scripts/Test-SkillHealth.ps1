<#
  Test-SkillHealth.ps1 —— drawio 技能自检
  ------------------------------------------------------------------
  这个技能有一类「只在运行时才暴露」的坑，形式化 lint 查不出来，所以这里跑的是
  真的检查 + 真的功能冒烟测试：

    1. 文件齐全（SKILL.md / README / README.en / references / examples）
    2. BOM 正确：.ps1 必须有、SKILL.md 必须没有
    3. 三个脚本语法可解析（AST 解析，不执行）
    4. 静态查「@() 包 List 变量」——PS 5.1 上会抛参数类型不匹配
    5. frontmatter 有效，且 name 与目录名一致
    6. **功能冒烟**：从示例规格生成 → 体检必须 0 问题 → 单页文件的页数必须报 1

  第 6 条是关键。曾经有一个 bug 只在**单页文件**上暴露：函数返回 List 被拆成裸对象，
  它的 .Count 是空，于是 `1..$pageCount` 退化成 `1..$null` = `1,0`，
  导出报出「页号超出范围：1,0」。多页文件完全正常，所以只测多页会漏掉。
  这里固定用**单页**产物去验页数。

  不需要 draw.io 桌面版（生成、体检、数页数都是纯 XML 操作）。

  用法：
    .\Test-SkillHealth.ps1
    .\Test-SkillHealth.ps1 -Deep     # 额外做功能冒烟测试
#>
[CmdletBinding()]
param([switch]$Deep)

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0

function Check {
    param([string]$Name, [scriptblock]$Body)
    try {
        $r = & $Body
        if ($r -eq $false) {
            Write-Host ("  ✗ {0}" -f $Name) -ForegroundColor Red
            $script:fail++
        } else {
            Write-Host ("  ✓ {0}" -f $Name) -ForegroundColor Green
            $script:pass++
        }
    } catch {
        Write-Host ("  ✗ {0}" -f $Name) -ForegroundColor Red
        Write-Host ("      {0}" -f $_.Exception.Message) -ForegroundColor DarkRed
        $script:fail++
    }
}

function Test-HasBom {
    param([string]$P)
    $b = [System.IO.File]::ReadAllBytes($P)
    return ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
}

$skillRoot = Split-Path -Parent $PSScriptRoot
$dirName   = Split-Path -Leaf $skillRoot

Write-Host ""
Write-Host ("drawio 技能自检 —— {0}" -f $skillRoot) -ForegroundColor Cyan
Write-Host ""

# ---------- 1. 文件齐全 ----------

Check '核心文件齐全（SKILL.md / README.md / README.en.md）' {
    foreach ($f in @('SKILL.md', 'README.md', 'README.en.md')) {
        if (-not (Test-Path -LiteralPath (Join-Path $skillRoot $f))) { throw "缺 $f" }
    }
    $true
}

Check 'references 齐全（4 篇）' {
    $refs = @(Get-ChildItem -LiteralPath (Join-Path $skillRoot 'references') -Filter '*.md' -File -ErrorAction SilentlyContinue)
    if ($refs.Count -lt 4) { throw ("references 只有 {0} 篇，期望 4" -f $refs.Count) }
    $true
}

Check '示例规格存在且是合法 JSON' {
    $ex = Join-Path $skillRoot 'examples/sample-architecture.json'
    if (-not (Test-Path -LiteralPath $ex)) { throw '缺 examples/sample-architecture.json' }
    $j = Get-Content -LiteralPath $ex -Raw -Encoding UTF8 | ConvertFrom-Json
    $pages = @($j.pages)
    if ($pages.Count -lt 1) { throw '示例规格没有 pages' }
    $true
}

# ---------- 2. BOM ----------

$scripts = @(Get-ChildItem -LiteralPath (Join-Path $skillRoot 'scripts') -Filter '*.ps1' -File |
             Sort-Object Name)
Check ("三个脚本都有 UTF-8 BOM（共 {0} 个 .ps1）" -f $scripts.Count) {
    if ($scripts.Count -lt 3) { throw ("只有 {0} 个脚本，期望 3" -f $scripts.Count) }
    $missing = @($scripts | Where-Object { -not (Test-HasBom $_.FullName) })
    if ($missing.Count -gt 0) { throw ("缺 BOM：{0}" -f (($missing.Name) -join ', ')) }
    $true
}

Check 'SKILL.md 没有 BOM' {
    if (Test-HasBom (Join-Path $skillRoot 'SKILL.md')) { throw 'SKILL.md 带了 BOM，会让 frontmatter 解析失效' }
    $true
}

# ---------- 3. 语法 ----------

Check '三个脚本语法可解析（AST）' {
    $bad = @()
    foreach ($s in $scripts) {
        $tok = $null; $err = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($s.FullName, [ref]$tok, [ref]$err)
        if ($err -and $err.Count -gt 0) {
            $bad += ("{0}: {1}" -f $s.Name, $err[0].Message)
        }
    }
    if ($bad.Count -gt 0) { throw ($bad -join ' | ') }
    $true
}

# ---------- 4. 静态查 @() 包 List ----------

Check '没有「@() 直接包 List 变量」的写法' {
    # PS 5.1 上 @($list) 会抛「参数类型不匹配」，必须 .ToArray()。
    # 做法：先找出所有从 List 构造出来的变量名，再看有没有 @($那个变量)。
    $bad = @()
    foreach ($s in $scripts) {
        $text = [System.IO.File]::ReadAllText($s.FullName, [System.Text.Encoding]::UTF8)
        $varNames = @()
        foreach ($m in [regex]::Matches($text, '(\$[A-Za-z_][A-Za-z0-9_]*)\s*=\s*New-Object\s+System\.Collections\.Generic\.List')) {
            $varNames += $m.Groups[1].Value
        }
        foreach ($v in $varNames) {
            $needle = "@($v)"
            if ($text.Contains($needle)) { $bad += ("{0}: {1}" -f $s.Name, $needle) }
        }
    }
    if ($bad.Count -gt 0) { throw ("发现会抛异常的写法 → {0}" -f ($bad -join '; ')) }
    $true
}

# ---------- 5. frontmatter ----------

Check 'frontmatter 有效且 name 与目录名一致' {
    $raw = [System.IO.File]::ReadAllText((Join-Path $skillRoot 'SKILL.md'), [System.Text.Encoding]::UTF8)
    if (-not $raw.StartsWith('---')) { throw "SKILL.md 不是以 --- 开头" }
    $end = $raw.IndexOf("`n---", 3)
    if ($end -lt 0) { throw 'frontmatter 没有结束的 ---' }
    $fm = $raw.Substring(3, $end - 3)
    $mName = [regex]::Match($fm, '(?m)^\s*name\s*:\s*(\S+)')
    if (-not $mName.Success) { throw 'frontmatter 缺 name' }
    if ($mName.Groups[1].Value -ne $dirName) {
        throw ("name='{0}' 与目录名 '{1}' 不一致（DSH 要求一致）" -f $mName.Groups[1].Value, $dirName)
    }
    if (-not [regex]::IsMatch($fm, '(?m)^\s*description\s*:\s*\S')) { throw 'frontmatter 缺 description' }
    if (-not [regex]::IsMatch($fm, '(?m)^\s*whenToUse\s*:\s*\S')) { throw 'frontmatter 缺 whenToUse' }
    $true
}

# ---------- 6. 功能冒烟 ----------

if ($Deep) {
    $tmp = Join-Path $env:TEMP 'drawio-skillhealth'
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $gen = Join-Path $tmp 'smoke.drawio'

    Check '生成器能从示例规格产出 .drawio' {
        & (Join-Path $PSScriptRoot 'New-Drawio.ps1') `
            -Spec (Join-Path $skillRoot 'examples/sample-architecture.json') `
            -Out $gen -Force | Out-Null
        if ($LASTEXITCODE -ne 0) { throw ("生成器退出码 {0}" -f $LASTEXITCODE) }
        if (-not (Test-Path -LiteralPath $gen)) { throw '没有产出文件' }
        $true
    }

    Check '产出的 .drawio 是合法 XML 且能数出 1 页' {
        [xml]$x = Get-Content -LiteralPath $gen -Raw -Encoding UTF8
        $d = @($x.mxfile.diagram)
        if ($d.Count -ne 1) { throw ("页数 {0}，期望 1" -f $d.Count) }
        $cells = @($x.SelectNodes('//mxCell'))
        if ($cells.Count -lt 20) { throw ("mxCell 只有 {0} 个，太少了" -f $cells.Count) }
        $true
    }

    Check '体检对自动布局的产物报 0 问题（退出码 0）' {
        & (Join-Path $PSScriptRoot 'Test-DrawioLayout.ps1') -Path $gen -Quiet | Out-Null
        if ($LASTEXITCODE -ne 0) { throw '体检报了问题——自动布局本该产出干净布局' }
        $true
    }

    Check '体检能查出问题（退出码 1）—— 用一份故意做坏的图' {
        $badFile = Join-Path $tmp 'broken.drawio'
        # 两个明显重叠的方框 + 一个探出容器的方框
        $xml = @'
<mxfile host="app.diagrams.net">
  <diagram id="b" name="broken">
    <mxGraphModel pageWidth="800" pageHeight="600">
      <root>
        <mxCell id="0" /><mxCell id="1" parent="0" />
        <mxCell id="c1" value="" style="rounded=1;fillColor=none;strokeColor=#cbd5e1;dashed=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="300" height="150" as="geometry" /></mxCell>
        <mxCell id="a" value="A" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="60" y="70" width="120" height="60" as="geometry" /></mxCell>
        <mxCell id="b" value="B" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="120" y="90" width="120" height="60" as="geometry" /></mxCell>
        <mxCell id="d" value="D" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="200" y="80" width="200" height="60" as="geometry" /></mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
'@
        [System.IO.File]::WriteAllText($badFile, $xml, [System.Text.UTF8Encoding]::new($false))
        & (Join-Path $PSScriptRoot 'Test-DrawioLayout.ps1') -Path $badFile -Quiet | Out-Null
        if ($LASTEXITCODE -ne 1) { throw ("退出码 {0}，期望 1（本该查出重叠与越界）" -f $LASTEXITCODE) }
        $true
    }

    Check '★ 单页文件的页数报 1（锁住裸对象 .Count 为空的坑）' {
        # 这个 bug 只在单页暴露：函数返回 List 被拆成裸 PSCustomObject，
        # 它的 .Count 是空，1..$null 变成 1,0，报「页号超出范围：1,0」。
        # 注意必须用 *>&1，不能用 2>&1。导出脚本是用 Write-Host 输出的，而
        # Write-Host 写的是**信息流**（stream 6），2>&1 只并错误流，抓到的长度是 0。
        $outText = & (Join-Path $PSScriptRoot 'Export-Drawio.ps1') -Path $gen -ListPages *>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { throw ("ListPages 退出码 {0}" -f $LASTEXITCODE) }
        if ($outText -notmatch '页数\s*:\s*1') {
            throw ("页数没报成 1。实际输出：`n{0}" -f $outText)
        }
        $true
    }
}

# ---------- 汇总 ----------

Write-Host ""
if ($script:fail -eq 0) {
    Write-Host ("全部通过：{0} 项{1}" -f $script:pass, $(if ($Deep) { '（含功能冒烟）' } else { '（未含功能冒烟，加 -Deep）' })) -ForegroundColor Green
    exit 0
} else {
    Write-Host ("未通过：{0} 项失败，{1} 项通过" -f $script:fail, $script:pass) -ForegroundColor Red
    exit 1
}
