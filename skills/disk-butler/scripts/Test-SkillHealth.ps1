<#
  Test-SkillHealth.ps1 —— 技能健康自检
  ------------------------------------------------------------------
  把"改脚本时踩过的坑"变成可执行的检查。改完任何文件后跑一遍。

  覆盖的坑：
    * .ps1 缺 UTF-8 BOM → 在 Windows PowerShell 5.1 下中文变乱码
    * .ps1 语法错误 → 只有运行到那一行才会炸
    * SKILL.md 带了 BOM → frontmatter 的 startsWith('---') 判定失效，技能描述丢掉
    * SKILL.md frontmatter 的 name 与目录名不一致 → 技能注册名对不上
    * 日志/临时产物落在技能目录里 → 会被 npm 打包发出去
    * index.js 语法错误 / 导出名不匹配
    * package.json 的 files 把不该发的目录扫进去
    * .codex-plugin/plugin.json 的 skills 字段没指向名为 skills 的目录

  用法：
    .\Test-SkillHealth.ps1            # 常规自检
    .\Test-SkillHealth.ps1 -Deep      # 额外检查 npm 打包内容（需要 npm）
#>
[CmdletBinding()]
param(
    [string]$SkillRoot = (Split-Path -Parent $PSScriptRoot),
    [switch]$Deep
)

$ErrorActionPreference = 'Continue'
# 仓库根解析：技能根是 <仓库>/skills/<名字>，本来上溯两级即可；
# 但通过 Junction（技能目录）调用时上溯会落到 .dsh 之类的无关目录，
# 所以先解析 Junction 的真实路径，再向上找带 package.json 的目录。
$realSkillRoot = $SkillRoot
$linkItem = Get-Item -LiteralPath $SkillRoot -Force -ErrorAction SilentlyContinue
if ($linkItem -and $linkItem.LinkType) { $realSkillRoot = $linkItem.Target }
$RepoRoot = $null
$probe = $realSkillRoot
for ($i = 0; $i -lt 5 -and $probe; $i++) {
    if (Test-Path (Join-Path $probe 'package.json')) { $RepoRoot = $probe; break }
    $parent = Split-Path -Parent $probe
    if (-not $parent -or $parent -eq $probe) { break }
    $probe = $parent
}
if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent (Split-Path -Parent $realSkillRoot) }

$script:Pass = 0
$script:Fail = 0
$script:Warn = 0

function Ok   { param([string]$m) Write-Host "  ✅ $m" -ForegroundColor Green;  $script:Pass++ }
function Bad  { param([string]$m, [string]$fix) Write-Host "  ❌ $m" -ForegroundColor Red; if ($fix) { Write-Host "      修法: $fix" -ForegroundColor Yellow }; $script:Fail++ }
function Warn { param([string]$m) Write-Host "  ⚠️  $m" -ForegroundColor Yellow; $script:Warn++ }
function Head { param([string]$m) Write-Host ""; Write-Host "== $m ==" -ForegroundColor Cyan }

Write-Host ""
Write-Host "================ disk-butler 技能自检 ================" -ForegroundColor Cyan
Write-Host (" 技能根 : {0}" -f $SkillRoot)
Write-Host (" 仓库根 : {0}" -f $RepoRoot)
if ($realSkillRoot -ne $SkillRoot) { Write-Host (" 技能真身: {0}  （技能根是 Junction）" -f $realSkillRoot) }

# ---------------------------------------------------------------- 1. .ps1
Head "PowerShell 脚本"

$ps1 = @(Get-ChildItem $SkillRoot -Recurse -Filter '*.ps1' -File -ErrorAction SilentlyContinue)
if ($ps1.Count -eq 0) { Bad "技能目录下没有找到 .ps1" }
foreach ($f in $ps1) {
    $b = [System.IO.File]::ReadAllBytes($f.FullName)
    $hasBom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
    if ($hasBom) { Ok "$($f.Name)  有 UTF-8 BOM" }
    else {
        Bad "$($f.Name)  缺 UTF-8 BOM" `
            "在 Windows PowerShell 5.1 下中文会乱码。修复：`$b=[IO.File]::ReadAllBytes('路径'); [IO.File]::WriteAllBytes('路径', ([byte[]](0xEF,0xBB,0xBF))+`$b)"
    }

    $err = $null
    [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$null, [ref]$err) | Out-Null
    if ($err -and $err.Count) {
        Bad "$($f.Name)  语法错误 $($err.Count) 处" "L$($err[0].Extent.StartLineNumber): $($err[0].Message)"
    } else { Ok "$($f.Name)  语法通过" }
}

# ---------------------------------------------------------------- 1b. 编码陷阱
# PS 5.1 下这组 cmdlet 不指定编码时按 ANSI(GBK) 处理，UTF-8 的中文会变乱码，
# 进而让 ConvertFrom-Json 直接崩。本项目真实发生过 8 次（读计划、读快照、读迁移记录）。
# 注意：命令名在这里是拼出来的——写字面量的话本行会匹配到自己，造成误报。
$encCmds  = @('Get','Set','Add') | ForEach-Object { "$_-" + 'Content' }
$encCmds += 'Out-' + 'File'
$encRe    = '(^|\|\s*)(' + ($encCmds -join '|') + ')\b'
$encHits  = @()
foreach ($f in $ps1) {
    $hits = Select-String -LiteralPath $f.FullName -Pattern $encRe -ErrorAction SilentlyContinue |
            Where-Object { $_.Line -notmatch '-Encoding' -and $_.Line.Trim() -notmatch '^#' }
    foreach ($h in $hits) { $encHits += ("{0}:{1}  {2}" -f $f.Name, $h.LineNumber, $h.Line.Trim()) }
}
if ($encHits.Count -gt 0) {
    Bad ("有 {0} 处文件读写未指定编码（PS 5.1 下按 GBK 处理，中文变乱码）" -f $encHits.Count) "在 -Raw 或 -Value 后加 -Encoding UTF8"
    $encHits | Select-Object -First 6 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
} else { Ok "所有文件读写都显式指定了编码" }
# ---------------------------------------------------------------- 1c. List[object] + @() 陷阱
# PS 5.1 下 @() 作用在 List[object] 上会抛"参数类型不匹配"——连空 List 都会炸；
# 但它对 List[string] / List[int] / List[pscustomobject] 都正常。
# 这个组合极容易误写，且只在运行时才暴露，所以做成静态检查。
$objVars = @{}
foreach ($f in $ps1) {
    foreach ($line in (Get-Content -LiteralPath $f.FullName -Encoding UTF8)) {
        if ($line -match '\$(\w+)\s*=\s*New-Object\s+System\.Collections\.Generic\.List\[object\]') {
            $objVars[$Matches[1]] = $f.Name
        }
    }
}
$badArr = @()
if ($objVars.Count -gt 0) {
    foreach ($f in $ps1) {
        $ln = 0
        foreach ($line in (Get-Content -LiteralPath $f.FullName -Encoding UTF8)) {
            $ln++
            foreach ($v in $objVars.Keys) {
                # 必须是 @($var) **紧接右括号**才算。写成 @($var | 管道) 是安全的
                # ——管道会先把 List 拆开，@() 再重新包成数组。误报会让人不信检查器，
                # 所以这里宁可收紧。
                if ($line -match ("@\(\s*\$" + [regex]::Escape($v) + '\s*\)')) {
                    $badArr += ("{0}:{1}  @(`${2})" -f $f.Name, $ln, $v)
                }
            }
        }
    }
}
if ($badArr.Count -gt 0) {
    Bad ("有 {0} 处把 @() 用在 List[object] 上（PS 5.1 下会抛参数类型不匹配）" -f $badArr.Count) '改用 <变量>.ToArray() 或 [array]<变量>'
    $badArr | Select-Object -First 6 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
} else { Ok "没有把 @() 用在 List[object] 上" }
# ---------------------------------------------------------------- 2. SKILL.md
Head "SKILL.md"

$skillMd = Join-Path $SkillRoot 'SKILL.md'
if (-not (Test-Path $skillMd)) {
    Bad "找不到 SKILL.md"
} else {
    $b = [System.IO.File]::ReadAllBytes($skillMd)
    $hasBom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
    if ($hasBom) {
        Bad "SKILL.md 带了 UTF-8 BOM" "会让 frontmatter 的 startsWith('---') 判定失效，技能描述丢失。必须去掉 BOM（用 UTF8Encoding(`$false) 重写）"
    } else { Ok "SKILL.md  无 BOM（正确）" }

    $text = [System.IO.File]::ReadAllText($skillMd, [System.Text.Encoding]::UTF8)
    if (-not $text.StartsWith('---')) {
        Bad "SKILL.md 未以 '---' 开头" "YAML frontmatter 必须在文件最开头"
    } else {
        $end = $text.IndexOf("`n---", 4)
        if ($end -lt 0) { Bad "frontmatter 没有闭合的 '---'" }
        else {
            $meta = $text.Substring(4, $end - 4)
            $nameM = [regex]::Match($meta, '(?m)^name:\s*(.+)$')
            $descM = [regex]::Match($meta, '(?m)^description:\s*(.+)$')
            if ($nameM.Success) { Ok "frontmatter name = $($nameM.Groups[1].Value.Trim())" }
            else { Bad "frontmatter 缺 name" "必填字段，且必须是 kebab-case" }
            if ($descM.Success -and $descM.Groups[1].Value.Trim().Length -gt 20) {
                Ok "frontmatter description 长度 $($descM.Groups[1].Value.Trim().Length)"
            } else { Bad "frontmatter 缺 description 或过短" "必填字段，它是目录里唯一被模型看到的一行" }

            # 技能注册名应与所在目录名一致
            $dirName = Split-Path $SkillRoot -Leaf
            if ($nameM.Success -and $nameM.Groups[1].Value.Trim() -ne $dirName) {
                Bad "name 与目录名不一致（目录 '$dirName'）" "DSH 文件系统技能发现按 <根>/<名字>/SKILL.md 定位，不一致会造成混淆"
            } elseif ($nameM.Success) { Ok "name 与目录名一致" }
        }
    }
}

# ---------------------------------------------------------------- 3. 技能目录不得有运行产物
Head "技能目录纯净度"

$junk = @(Get-ChildItem $SkillRoot -Recurse -Force -ErrorAction SilentlyContinue |
          Where-Object { $_.Name -in 'logs','junctions' -or $_.Extension -in '.log','.tgz' -or $_.Name -like '*-plan.json' })
if ($junk.Count -gt 0) {
    Bad "技能目录里有 $($junk.Count) 个运行产物（会被 npm 打包发出去）" (($junk | ForEach-Object { $_.FullName }) -join '; ')
    Write-Host "      日志与迁移记录应写到 `$env:LOCALAPPDATA\disk-butler\ 下" -ForegroundColor Yellow
} else { Ok "技能目录干净（无日志/打包残留）" }

# ---------------------------------------------------------------- 4. 插件包装（可选）
Head "插件包装"

$idx = Join-Path $RepoRoot 'index.js'
if (Test-Path $idx) {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if ($node) {
        $null = & $node --check $idx 2>&1
        if ($LASTEXITCODE -eq 0) { Ok "index.js 语法通过" } else { Bad "index.js 语法错误" "node --check $idx" }
    } else { Warn "未找到 node，跳过 index.js 语法检查" }

    $js = Get-Content $idx -Raw -Encoding UTF8
    $dirName = Split-Path $SkillRoot -Leaf

    if ($js -match "export const name = '([^']+)'") {
        $idxName = $Matches[1]
        # 在合集仓库里 index.js 的身份是「合集」，名字与单个技能目录名无关；
        # 真正的不变量是它与 package.json#name 一致。所以分两种情况判断。
        if ($js -match 'discoverSkills') {
            Ok "index.js 是合集入口（导出 discoverSkills，名字 $idxName）"
        } elseif ($idxName -eq $dirName) {
            Ok "index.js 导出 name 与技能目录名一致（$idxName）"
        } else {
            Bad "index.js 导出 name='$idxName' 与目录名 '$dirName' 不一致" `
                "单技能仓库里两者必须一致；若是合集仓库，入口应导出 discoverSkills"
        }
    } else { Bad "index.js 里找不到 export const name" }

    if ($js -match 'resourceBase') { Ok "index.js 设置了 resourceBase（相对引用才能解析）" }
    else { Bad "index.js 没有 resourceBase" "SKILL.md 里的 scripts/、references/ 相对引用会失效" }

    # 合集模式下，本技能必须能被入口发现
    if ($js -match 'discoverSkills') {
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCmd) {
            $probe = & $nodeCmd.Source -e "import('file:///$($idx -replace '\\','/')').then(m=>{const s=m.discoverSkills().map(x=>x.name);console.log(JSON.stringify(s))}).catch(e=>{console.log('ERR:'+e.message)})" 2>&1
            if ("$probe" -match 'ERR:') {
                Warn "无法调用 discoverSkills：$probe"
            } elseif ("$probe" -match "`"$([regex]::Escape($dirName))`"") {
                Ok "合集入口的 discoverSkills 能发现本技能（$probe）"
            } else {
                Bad "合集入口未能发现本技能 '$dirName'" "discoverSkills 返回 $probe"
            }
        }
    }
} else { Warn "仓库根没有 index.js，跳过 DSH 插件包装检查" }

$pkg = Join-Path $RepoRoot 'package.json'
if (Test-Path $pkg) {
    $pj = Get-Content $pkg -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($pj.dsh.bundle.patch) {
        $patchPath = Join-Path $RepoRoot ($pj.dsh.bundle.patch -replace '^\./','')
        if (Test-Path $patchPath) { Ok "dsh.bundle.patch 指向的文件存在" }
        else { Bad "dsh.bundle.patch 指向的 $($pj.dsh.bundle.patch) 不存在" }
    } else { Warn "package.json 未声明 dsh.bundle.patch（不作为 DSH 插件分发时可忽略）" }

    if ($pj.files -contains 'skills') { Ok "package.json#files 含 skills" }
    else { Bad "package.json#files 未包含 skills" "技能本体不会被发布" }

    $badFiles = @($pj.files | Where-Object { $_ -in 'logs','scripts','_ref' })
    if ($badFiles.Count -gt 0) { Bad "package.json#files 含不该发布的项: $($badFiles -join ',')" }
    else { Ok "package.json#files 无运行产物目录" }
} else { Warn "仓库根没有 package.json" }

$pluginJson = Join-Path $RepoRoot '.codex-plugin\plugin.json'
if (Test-Path $pluginJson) {
    $cp = Get-Content $pluginJson -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($cp.skills -and ((Split-Path ($cp.skills.TrimEnd('/')) -Leaf) -eq 'skills')) {
        Ok ".codex-plugin 的 skills 字段指向 skills 目录"
    } else { Bad ".codex-plugin 的 skills 字段必须指向名为 skills 的目录" "Codex 插件校验器会直接拒绝" }
    # 必填字段
    foreach ($k in 'name','version','description') {
        if (-not $cp.$k) { Bad "plugin.json 缺必填字段 $k" }
    }
    if (-not $cp.author.name) { Bad "plugin.json 缺 author.name" }
    else { Ok "plugin.json 必填字段齐全" }
} else { Warn "没有 .codex-plugin/plugin.json，跳过 Codex 插件检查" }

# ---------------------------------------------------------------- 5. 打包内容（-Deep）
if ($Deep) {
    Head "npm 打包内容"
    $npm = (Get-Command npm -ErrorAction SilentlyContinue).Source
    if (-not $npm) { Warn "未找到 npm，跳过" }
    else {
        Push-Location $RepoRoot
        $out = & npm pack --dry-run 2>&1 | Out-String
        Pop-Location
        # 关键：pack 没成功就不能当作"干净"——假通过比报错更危险
        if ($LASTEXITCODE -ne 0 -or $out -notmatch 'npm notice') {
            Warn "npm pack 未成功执行（仓库根: $RepoRoot），无法判断打包内容"
            $out = ''
        }
        $bad = [regex]::Matches($out, '(?m)^npm notice [\d.]+kB (\S+)') |
               ForEach-Object { $_.Groups[1].Value } |
               Where-Object { $_ -match '\.log$|/logs/|\.tgz$|_ref/' }
        if ($bad) { Bad "打包内容含不该发布的文件: $($bad -join ', ')" }
        else { Ok "打包内容干净" }
    }
}

# ---------------------------------------------------------------- 汇总
Write-Host ""
Write-Host "================ 结果 ================" -ForegroundColor Cyan
Write-Host ("  ✅ 通过 {0}    ⚠️ 警告 {1}    ❌ 失败 {2}" -f $script:Pass, $script:Warn, $script:Fail) `
    -ForegroundColor $(if ($script:Fail -gt 0) { 'Red' } elseif ($script:Warn -gt 0) { 'Yellow' } else { 'Green' })
if ($script:Fail -gt 0) {
    Write-Host ""
    Write-Host " 有失败项，修完再发布。" -ForegroundColor Red
}
Write-Host ""

exit $(if ($script:Fail -gt 0) { 1 } else { 0 })
