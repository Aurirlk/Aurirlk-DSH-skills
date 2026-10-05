<#
  Find-Junk.ps1 —— 只扫描，绝不删除
  ------------------------------------------------------------------
  扫描本机的"可清理对象"，按分类和安全等级产出一份清理计划。
  真正的删除交给 Invoke-Cleanup.ps1，它在执行时会重新校验安全规则。

  怎么用：
    # 人看的摘要
    powershell -ExecutionPolicy Bypass -File Find-Junk.ps1

    # 机器可读的计划（给 agent 或执行器用）
    powershell -ExecutionPolicy Bypass -File Find-Junk.ps1 -JsonOut plan.json

    # 只扫某几类
    powershell -ExecutionPolicy Bypass -File Find-Junk.ps1 -Categories temp,agent-residue

    # 调整"过期"阈值（默认 7 天）
    powershell -ExecutionPolicy Bypass -File Find-Junk.ps1 -Days 30

  安全等级：
    Safe    可直接清理，删了只会重建或本来就是垃圾
    Confirm 需要人确认（可能含用户数据 / 需要管理员 / 影响可感知）
    Report  只报告不清理（大文件、用户数据，交给人判断）
#>
[CmdletBinding()]
param(
    # 超过多少天算"过期"
    [int]      $Days = 7,

    # 只扫描指定分类（留空 = 全部）
    [string[]] $Categories,

    # 输出机器可读的计划 JSON
    [string]   $JsonOut,

    # 大文件报告阈值（MB）
    [int]      $LargeFileMB = 1024,

    # 扫描这些根目录下的项目构建缓存（默认不扫，耗时）
    [string[]] $ProjectRoots,

    # 额外要扫描的 _npx 等残余的根目录（默认扫描常见的几个）
    [string[]] $ExtraSearchRoots
)

$ErrorActionPreference = 'Continue'

# ============================================================ 安全层
# 所有"能否安全删除"的判断集中在这里，扫描器和执行器共用。

$script:EnvAnchors = @()
function Initialize-EnvAnchors {
    # 收集所有"指向某个盘符路径"的环境变量值，作为活跃配置锚点
    $script:EnvAnchors = @()
    foreach ($e in [Environment]::GetEnvironmentVariables('User').GetEnumerator() +
                   [Environment]::GetEnvironmentVariables('Machine').GetEnumerator()) {
        $v = "$($e.Value)"
        if ($v -match '^[A-Za-z]:\\') { $script:EnvAnchors += $v.TrimEnd('\') }
    }
}

function Test-PathProtectedByEnv {
    <# 该路径（或它的祖先）是否正好是某个环境变量指向的目标？
       是 → 说明它是活跃配置位置，绝不能删。 #>
    param([string]$Path)
    $p = $Path.TrimEnd('\')
    foreach ($a in $script:EnvAnchors) {
        if ($p -ieq $a -or $a.StartsWith($p + '\', 'OrdinalIgnoreCase')) { return $a }
    }
    return $null
}

function Test-HasBackupSubdir {
    <# 候选目录里是否藏着备份/恢复类子目录？
       这次就是这样才发现 WPS_Cache 里有 82.8 MB 的文档恢复副本。
       只向下看三级，找到即返回。 #>
    param([string]$Path, [int]$Depth = 3)
    $pattern = '^(backup|backups|recover|recovery|restore|备份|恢复|autosave)$'
    try {
        $stack = New-Object System.Collections.Generic.Stack[object]
        $stack.Push(@{ P = $Path; D = 0 })
        while ($stack.Count -gt 0) {
            $cur = $stack.Pop()
            if ($cur.D -ge $Depth) { continue }
            foreach ($d in [System.IO.Directory]::EnumerateDirectories($cur.P)) {
                $leaf = Split-Path $d -Leaf
                if ($leaf -match $pattern) { return $d }
                $stack.Push(@{ P = $d; D = $cur.D + 1 })
            }
        }
    } catch { }
    return $null
}

function Get-PathSizeInfo {
    param([string]$Path, [int]$OlderThanDays = 0)
    $sum = 0L; $cnt = 0
    try {
        $cutoff = (Get-Date).AddDays(-$OlderThanDays)
        $stack = New-Object System.Collections.Generic.Stack[string]
        $stack.Push($Path)
        while ($stack.Count -gt 0) {
            $cur = $stack.Pop()
            try {
                foreach ($f in [System.IO.Directory]::EnumerateFiles($cur)) {
                    try {
                        $fi = [System.IO.FileInfo]$f
                        if ($OlderThanDays -le 0 -or $fi.LastWriteTime -lt $cutoff) { $sum += $fi.Length; $cnt++ }
                    } catch { }
                }
                foreach ($d in [System.IO.Directory]::EnumerateDirectories($cur)) { $stack.Push($d) }
            } catch { }
        }
    } catch { }
    return [pscustomobject]@{ Bytes = $sum; Count = $cnt }
}

function Format-Size2 {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return ('{0} B' -f [int]$Bytes)
}

Initialize-EnvAnchors

# ============================================================ 计划收集
$plan = New-Object System.Collections.Generic.List[object]

function Add-Item {
    param(
        [string]$Id, [string]$Category, [string]$Safety, [string]$Target,
        [string]$Mode = 'WholeDir', [int]$OlderThanDays = 0,
        [string]$Reason = '', [string]$Hint = '', [bool]$NeedsAdmin = $false
    )
    if ($Categories -and $Category -notin $Categories) { return }
    if (-not (Test-Path -LiteralPath $Target)) { return }

    # ---- 安全层：此处拦截，计划里就不会出现不该删的东西 ----
    $envHit = Test-PathProtectedByEnv $Target
    if ($envHit -and $Mode -eq 'WholeDir') {
        # 整体删除一个"被环境变量指向"的目录 = 破坏活跃配置，一律拒绝
        Write-Host ("  跳过（整体删除目标被环境变量指向: {0}）" -f $envHit) -ForegroundColor DarkYellow
        return
    }
    $envNote = $null
    if ($envHit) {
        # 按时间只清"里面的旧文件"，不碰目录本身，所以允许；
        # 但这仍是活跃位置，安全等级必须降级为需人工确认。
        $envNote = "该目录被环境变量指向（$envHit），本项只清其中超过 $OlderThanDays 天的文件，不动目录本身"
        if ($Safety -eq 'Safe') { $Safety = 'Confirm' }
    }

    $info = Get-PathSizeInfo -Path $Target -OlderThanDays $OlderThanDays
    if ($info.Count -eq 0) { return }

    $plan.Add([pscustomobject]@{
        Id             = $Id
        Category       = $Category
        Safety         = $Safety
        Target         = $Target
        Mode           = $Mode
        OlderThanDays  = $OlderThanDays
        Bytes          = $info.Bytes
        ItemCount      = $info.Count
        Reason         = $Reason
        Hint           = $Hint
        NeedsAdmin     = $NeedsAdmin
        EnvProtected   = [bool]$envHit
        EnvNote        = $envNote
        HasBackupSub   = [bool](Test-HasBackupSubdir $Target)
    })
}

Write-Host ""
Write-Host "================ 磁盘垃圾扫描（只读，不删除）================" -ForegroundColor Cyan
Write-Host (" 时间: {0}   过期阈值: {1} 天" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Days)
Write-Host ""

$TEMP = $env:TEMP
$LOCAL = $env:LOCALAPPDATA
$USERP = $env:USERPROFILE

# ---------------------------------------------------------- 1. 临时文件
Write-Host "[1/7] 临时文件 ..." -ForegroundColor Yellow
Add-Item -Id 'temp-user-old' -Category 'temp' -Safety 'Safe' -Target $TEMP `
    -Mode 'AgeFilter' -OlderThanDays $Days `
    -Reason "用户临时目录中超过 $Days 天没被写入的文件" `
    -Hint "正在运行的程序可能占用其中部分文件，删不掉的会跳过；想要更保守就加 -Days 30"

Add-Item -Id 'temp-windows' -Category 'temp' -Safety 'Confirm' -Target 'C:\Windows\Temp' `
    -Mode 'AgeFilter' -OlderThanDays $Days -NeedsAdmin $true `
    -Reason '系统临时目录' -Hint '需要管理员权限'

# ---------------------------------------------------------- 2. Agent 运行残余
Write-Host "[2/7] Agent 运行残余 ..." -ForegroundColor Yellow

# npx 临时安装缓存：agent 跑 `npx -y <包>` 留下的解包副本。
# 这是"Agent 运行脚本残余"最典型的一类，长期累积可观。
$npxRoots = @(
    "$LOCAL\npm-cache\_npx"
    "$USERP\.npm\_npx"
    "$USERP\npm-cache\_npx"
    "$env:APPDATA\npm-cache\_npx"
    "$env:APPDATA\npm\_npx"
    'D:\Program Files\Node_js\node_cache\_npx'
)
if ($ExtraSearchRoots) { $npxRoots += @($ExtraSearchRoots | ForEach-Object { Join-Path $_ '_npx' }) }
foreach ($n in ($npxRoots | Select-Object -Unique)) {
    Add-Item -Id ("npx-" + ($n -replace '[^A-Za-z0-9]','_')) -Category 'agent-residue' -Safety 'Safe' `
        -Target $n -Mode 'WholeDir' `
        -Reason 'npx 临时安装的包副本，下次用到会重新下载' `
        -Hint 'agent 每次 `npx -y` 都会在这里留一份，长期累积可观'
}

# DSH 会话产物
foreach ($sub in 'dsh-spill-*','dsh-subprocess-*','dsh-workspace-changes-*','dsh-acl-skill-*','dsh-acl-locks') {
    Get-ChildItem -LiteralPath $TEMP -Directory -Force -Filter $sub -ErrorAction SilentlyContinue | ForEach-Object {
        Add-Item -Id ("dsh-" + $_.Name) -Category 'agent-residue' -Safety 'Safe' -Target $_.FullName `
            -Mode 'AgeFilter' -OlderThanDays 1 `
            -Reason 'DSH 会话的临时中转产物，会话结束后即可清' `
            -Hint '当前会话正在使用的那份会被占用，删不掉会自动跳过'
    }
}

# 其它 agent 的临时目录（只动 temp 性质的位置，不动它们的会话数据）
$agentTemps = @(
    "$TEMP\claude", "$TEMP\opencode", "$TEMP\codex", "$TEMP\cursor", "$TEMP\aider"
    "$USERP\.codex\.tmp", "$USERP\.claude\tmp", "$USERP\.opencode\tmp"
    "$env:APPDATA\codex\.tmp"
)
foreach ($a in ($agentTemps | Select-Object -Unique)) {
    Add-Item -Id ("agent-tmp-" + ($a -replace '[^A-Za-z0-9]','_')) -Category 'agent-residue' -Safety 'Safe' `
        -Target $a -Mode 'AgeFilter' -OlderThanDays $Days `
        -Reason 'agent 工具的临时工作目录' `
        -Hint '不含凭据与会话记录（那些在 auth.json / sessions 里，本工具不会碰）'
}

# ~/.cache/<tool> —— 各工具约定俗成的本地缓存。
# 注意：这里面有的体积很大（浏览器内核、模型权重），删了会重新下载，所以标 Confirm。
Write-Host "      ~/.cache/<工具> ..." -ForegroundColor DarkGray
$homeCache = "$USERP\.cache"
if (Test-Path $homeCache) {
    Get-ChildItem $homeCache -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
        Add-Item -Id ("homecache-" + $_.Name) -Category 'home-cache' -Safety 'Confirm' -Target $_.FullName `
            -Mode 'WholeDir' `
            -Reason ("工具本地缓存：{0}" -f $_.Name) `
            -Hint '删了会在下次使用时重新下载；大体积项（浏览器内核、模型权重）请先确认'
    }
}

# ---------------------------------------------------------- 3. 崩溃与诊断
Write-Host "[3/7] 崩溃转储与诊断 ..." -ForegroundColor Yellow
foreach ($c in "$LOCAL\CrashDumps", "$LOCAL\Microsoft\Windows\WER\ReportArchive", "$LOCAL\Microsoft\Windows\WER\ReportQueue") {
    Add-Item -Id ("crash-" + (Split-Path $c -Leaf)) -Category 'crashdump' -Safety 'Safe' -Target $c `
        -Mode 'WholeDir' -Reason '程序崩溃转储 / 错误报告归档' -Hint '排查完崩溃后就没有保留价值'
}

# ---------------------------------------------------------- 4. 包管理器缓存
Write-Host "[4/7] 包管理器缓存 ..." -ForegroundColor Yellow
$pkgCaches = @(
    @{ P = "$LOCAL\npm-cache\_cacache";       N = 'npm 缓存' }
    @{ P = "$USERP\npm-cache\_cacache";        N = 'npm 缓存（非标准位置）' }
    @{ P = "$LOCAL\pnpm\store";                N = 'pnpm store（注意：清了所有项目要重新装）' }
    @{ P = "$LOCAL\pip\cache";                 N = 'pip 缓存' }
    @{ P = "$LOCAL\uv\cache";                  N = 'uv 缓存' }
    @{ P = "$LOCAL\Yarn\Cache";                N = 'Yarn 缓存' }
    @{ P = "$USERP\.m2\repository";            N = 'Maven 本地仓库（清了要重新下依赖）' }
    @{ P = "$USERP\.gradle\caches";            N = 'Gradle 缓存' }
    @{ P = "$USERP\.cargo\registry\cache";     N = 'Cargo 下载缓存' }
)
foreach ($c in $pkgCaches) {
    $safety = if ($c.N -match 'store|仓库') { 'Confirm' } else { 'Safe' }
    Add-Item -Id ("pkg-" + (Split-Path $c.P -Leaf)) -Category 'dev-cache' -Safety $safety -Target $c.P `
        -Mode 'WholeDir' -Reason $c.N -Hint '删了会在下次安装时重新下载'
}

# ---------------------------------------------------------- 5. 浏览器缓存
Write-Host "[5/7] 浏览器缓存 ..." -ForegroundColor Yellow
$browsers = @{
    'Chrome' = "$LOCAL\Google\Chrome\User Data"
    'Edge'   = "$LOCAL\Microsoft\Edge\User Data"
    'Brave'  = "$LOCAL\BraveSoftware\Brave-Browser\User Data"
}
foreach ($b in $browsers.GetEnumerator()) {
    if (-not (Test-Path $b.Value)) { continue }
    Get-ChildItem $b.Value -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^(Default|Profile \d+)$' } | ForEach-Object {
            foreach ($sub in 'Cache','Code Cache','GPUCache','Service Worker\CacheStorage') {
                Add-Item -Id ("browser-" + $b.Key + "-" + ($sub -replace '[^A-Za-z0-9]','_')) `
                    -Category 'browser-cache' -Safety 'Confirm' -Target (Join-Path $_.FullName $sub) `
                    -Mode 'AgeFilter' -OlderThanDays $Days `
                    -Reason ("{0} 的 {1}" -f $b.Key, $sub) `
                    -Hint '会重建；建议先关掉浏览器'
            }
        }
}

# ---------------------------------------------------------- 6. 系统更新残留 + 回收站
Write-Host "[6/7] 更新残留与回收站 ..." -ForegroundColor Yellow
Add-Item -Id 'winupdate-download' -Category 'update-residue' -Safety 'Confirm' `
    -Target 'C:\Windows\SoftwareDistribution\Download' -Mode 'WholeDir' -NeedsAdmin $true `
    -Reason 'Windows 更新下载缓存' -Hint '建议先停 wuauserv 服务再清'

foreach ($d in (Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3')) {
    $rb = "$($d.DeviceID)\`$RECYCLE.BIN"
    Add-Item -Id ("recycle-" + $d.DeviceID.TrimEnd(':')) -Category 'recycle-bin' -Safety 'Confirm' `
        -Target $rb -Mode 'WholeDir' `
        -Reason '回收站' -Hint '清空前请确认里面没有还要恢复的文件'
}

# ---------------------------------------------------------- 7. 大文件报告
Write-Host "[7/7] 大文件 ..." -ForegroundColor Yellow
$bigRoots = @("$USERP\Downloads", "$USERP\Desktop", "$USERP\Documents")
foreach ($r in $bigRoots) {
    if (-not (Test-Path $r)) { continue }
    Get-ChildItem $r -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Length -ge ($LargeFileMB * 1MB) } |
        Sort-Object Length -Descending | Select-Object -First 20 | ForEach-Object {
            $plan.Add([pscustomobject]@{
                Id = 'bigfile-' + $_.Name; Category = 'large-file'; Safety = 'Report'
                Target = $_.FullName; Mode = 'None'; OlderThanDays = 0
                Bytes = $_.Length; ItemCount = 1
                Reason = ("单文件 {0}，最后修改 {1}" -f (Format-Size2 $_.Length), $_.LastWriteTime.ToString('yyyy-MM-dd'))
                Hint = '只报告，不清理'; NeedsAdmin = $false; HasBackupSub = $false
            })
        }
}

# ---------------------------------------------------------- 8. 项目构建缓存（可选）
if ($ProjectRoots) {
    Write-Host "[+]  项目构建缓存 ..." -ForegroundColor Yellow
    foreach ($root in $ProjectRoots) {
        Get-ChildItem $root -Recurse -Directory -Force -Depth 4 -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -in '.turbo','.next','.nuxt','.parcel-cache','.vite' -or ($_.Name -eq '.cache' -and $_.Parent.Name -eq 'node_modules') } |
            ForEach-Object {
                Add-Item -Id ("buildcache-" + ($_.FullName -replace '[^A-Za-z0-9]','_')) -Category 'build-cache' `
                    -Safety 'Safe' -Target $_.FullName -Mode 'WholeDir' `
                    -Reason '项目构建缓存' -Hint '下次构建会重建'
            }
    }
}

# ============================================================ 输出
$planArr = @($plan | Sort-Object { $_.Bytes } -Descending)
$totalSafe    = ($planArr | Where-Object { $_.Safety -eq 'Safe' }    | Measure-Object Bytes -Sum).Sum
$totalConfirm = ($planArr | Where-Object { $_.Safety -eq 'Confirm' } | Measure-Object Bytes -Sum).Sum
$totalReport  = ($planArr | Where-Object { $_.Safety -eq 'Report' }  | Measure-Object Bytes -Sum).Sum

Write-Host ""
Write-Host "================ 扫描结果 ================" -ForegroundColor Cyan
foreach ($cat in ($planArr | Group-Object Category | Sort-Object { ($_.Group | Measure-Object Bytes -Sum).Sum } -Descending)) {
    $s = ($cat.Group | Measure-Object Bytes -Sum).Sum
    Write-Host ("`n[{0}]  合计 {1}" -f $cat.Name, (Format-Size2 $s)) -ForegroundColor Green
    foreach ($i in ($cat.Group | Sort-Object Bytes -Descending)) {
        $flag = switch ($i.Safety) { 'Safe' { '✅' } 'Confirm' { '⚠️ ' } 'Report' { '📄' } }
        $bk = if ($i.HasBackupSub) { '  🔴含备份子目录' } else { '' }
        Write-Host ("  {0} {1,10}  {2}{3}" -f $flag, (Format-Size2 $i.Bytes), $i.Target, $bk)
        Write-Host ("       └ {0}" -f $i.Reason) -ForegroundColor DarkGray
        if ($i.Hint) { Write-Host ("       └ {0}" -f $i.Hint) -ForegroundColor DarkGray }
    }
}

Write-Host ""
Write-Host "================ 汇总 ================" -ForegroundColor Cyan
Write-Host ("  ✅ Safe    可安全清理 : {0,10}   （{1} 项）" -f (Format-Size2 $totalSafe),    @($planArr | Where-Object { $_.Safety -eq 'Safe' }).Count) -ForegroundColor Green
Write-Host ("  ⚠️  Confirm 需确认     : {0,10}   （{1} 项）" -f (Format-Size2 $totalConfirm), @($planArr | Where-Object { $_.Safety -eq 'Confirm' }).Count) -ForegroundColor Yellow
Write-Host ("  📄 Report  仅报告     : {0,10}   （{1} 项）" -f (Format-Size2 $totalReport),  @($planArr | Where-Object { $_.Safety -eq 'Report' }).Count) -ForegroundColor DarkGray

$needsAdmin = @($planArr | Where-Object { $_.NeedsAdmin })
if ($needsAdmin) {
    Write-Host ""
    Write-Host ("  ⚠️  其中 {0} 项需要管理员权限：" -f $needsAdmin.Count) -ForegroundColor Yellow
    $needsAdmin | ForEach-Object { Write-Host ("      " + $_.Target) -ForegroundColor DarkYellow }
}

$withBackup = @($planArr | Where-Object { $_.HasBackupSub })
if ($withBackup) {
    Write-Host ""
    Write-Host "  🔴 以下目标内部含备份/恢复类子目录，执行清理时必须先人工确认：" -ForegroundColor Red
    $withBackup | ForEach-Object { Write-Host ("      " + $_.Target) -ForegroundColor Red }
}

if ($JsonOut) {
    $payload = [pscustomobject]@{
        schemaVersion = 1
        generatedAt   = (Get-Date).ToString('o')
        computer      = $env:COMPUTERNAME
        daysThreshold = $Days
        summary       = [pscustomobject]@{
            safe    = $totalSafe
            confirm = $totalConfirm
            report  = $totalReport
        }
        items = $planArr
    }
    $payload | ConvertTo-Json -Depth 6 | Set-Content -Path $JsonOut -Encoding UTF8
    Write-Host ""
    Write-Host (" 计划已写入: {0}" -f $JsonOut) -ForegroundColor Green
    Write-Host " 下一步（确认无误后）：" -ForegroundColor Gray
    Write-Host ("   Invoke-Cleanup.ps1 -Plan `"{0}`"                # 预演（不加 -Execute 就不会删）" -f $JsonOut) -ForegroundColor Gray
    Write-Host ("   Invoke-Cleanup.ps1 -Plan `"{0}`" -Execute -Safety Safe   # 只清安全项" -f $JsonOut) -ForegroundColor Gray
}

Write-Host ""
Write-Host " 本脚本只扫描，未删除任何文件。" -ForegroundColor Cyan
Write-Host ""
