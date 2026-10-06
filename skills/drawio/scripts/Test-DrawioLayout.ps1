<#
  Test-DrawioLayout.ps1 —— draw.io 图表布局体检（只读）
  ------------------------------------------------------------------
  查四类缺陷。它们都不会让文件出错，只会让图看不懂：

    1. 方框重叠    两个形状部分相交
    2. 越出容器    形状一大半在所属分层容器之外
    3. 连线穿框    边穿过了无关的第三个形状
    4. 文字溢出    文字估算宽度超过方框可用宽度

  为什么需要自动查：这三类在缩略图上完全看不出来，在密集区域人眼会把
  重叠当成"一组"，而正交连线横穿中间方框看起来"本来就该这样"。

  豁免规则（很重要，否则噪声会淹没真问题）：
    - style 以 text; 开头（或 fillColor=none 且 strokeColor=none）的视为纯标签，
      不参与重叠检查 —— 标题、层名本来就压在别的东西上
    - 一个形状完全包含另一个 = 有意的叠放（面板套卡片），不算重叠
    - 连线穿过**虚线分层容器**是正常的，容器不参与穿框检查

  用法：
    .\Test-DrawioLayout.ps1 -Path .\架构.drawio
    .\Test-DrawioLayout.ps1 -Path .\架构.drawio -Tolerance 6
    .\Test-DrawioLayout.ps1 -Path .\架构.drawio -Quiet      # 只给结论，退出码 1 表示有问题

  退出码：0 = 没发现，1 = 有发现或读不了
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Path,

    [double]$Tolerance = 4,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

# ---------- 解析 ----------

function Expand-CompressedDiagram {
    # draw.io 压缩格式：base64 -> raw deflate -> URL 编码(encodeURIComponent)
    param([string]$Text)
    $b64 = ($Text -replace '\s', '')
    if (-not $b64) { throw 'diagram 节点既没有 mxGraphModel 也没有可解码的内容' }
    $bytes = [Convert]::FromBase64String($b64)
    $ms = New-Object System.IO.MemoryStream
    $ms.Write($bytes, 0, $bytes.Length)
    $ms.Position = 0
    $ds = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
    $sr = New-Object System.IO.StreamReader($ds, [System.Text.Encoding]::UTF8)
    $xmlText = $sr.ReadToEnd()
    $sr.Dispose(); $ds.Dispose(); $ms.Dispose()
    return [System.Uri]::UnescapeDataString($xmlText)
}

function Get-ModelNode {
    param([System.Xml.XmlElement]$DiagramNode)
    $m = $DiagramNode.SelectSingleNode('mxGraphModel')
    if ($m) { return $m }
    $xmlText = Expand-CompressedDiagram -Text $DiagramNode.InnerText
    $d = New-Object System.Xml.XmlDocument
    $d.LoadXml($xmlText)
    return $d.DocumentElement
}

function ToD {
    param($V, [double]$Default = 0)
    if ($null -eq $V) { return $Default }
    $s = [string]$V
    if ($s -eq '') { return $Default }
    $r = 0.0
    if ([double]::TryParse($s, [ref]$r)) { return $r }
    return $Default
}

function Get-TextWidth {
    param([string]$Text, [double]$FontSize)
    if (-not $Text) { return 0.0 }
    $w = 0.0
    foreach ($ch in $Text.ToCharArray()) {
        $cp = [int]$ch
        $isWide = $false
        if ($cp -ge 0x1100 -and $cp -le 0x115F) { $isWide = $true }
        elseif ($cp -ge 0x2E80 -and $cp -le 0xA4CF) { $isWide = $true }
        elseif ($cp -ge 0xAC00 -and $cp -le 0xD7A3) { $isWide = $true }
        elseif ($cp -ge 0xF900 -and $cp -le 0xFAFF) { $isWide = $true }
        elseif ($cp -ge 0xFE30 -and $cp -le 0xFE6F) { $isWide = $true }
        elseif ($cp -ge 0xFF00 -and $cp -le 0xFF60) { $isWide = $true }
        elseif ($cp -ge 0xFFE0 -and $cp -le 0xFFE6) { $isWide = $true }
        if ($isWide) { $w += $FontSize } else { $w += $FontSize * 0.55 }
    }
    return $w
}

function Get-StyleVal {
    param([string]$Style, [string]$Key, [string]$Default = '')
    if (-not $Style) { return $Default }
    $m = [regex]::Match($Style, "(?:^|;)\s*$([regex]::Escape($Key))\s*=\s*([^;]*)")
    if ($m.Success) { return $m.Groups[1].Value }
    return $Default
}

function Read-Diagram {
    param([string]$File)
    $raw = [System.IO.File]::ReadAllText($File, [System.Text.Encoding]::UTF8)
    $doc = New-Object System.Xml.XmlDocument
    $doc.LoadXml($raw)
    $diagNodes = @($doc.SelectNodes('/mxfile/diagram'))
    if ($diagNodes.Count -eq 0) { throw "不是有效的 .drawio 文件（找不到 /mxfile/diagram）：$File" }

    $pages = New-Object System.Collections.Generic.List[object]
    $i = 0
    foreach ($dn in $diagNodes) {
        $i++
        $name = $dn.GetAttribute('name')
        if (-not $name) { $name = "page$i" }
        $model = Get-ModelNode -DiagramNode $dn

        $vertices = New-Object System.Collections.Generic.List[object]
        $edges    = New-Object System.Collections.Generic.List[object]

        foreach ($c in @($model.SelectNodes('.//mxCell'))) {
            $id = $c.GetAttribute('id')
            if ($id -eq '0' -or $id -eq '1') { continue }
            $style = $c.GetAttribute('style')
            $value = $c.GetAttribute('value')
            $geo = $c.SelectSingleNode('mxGeometry')

            if ($c.GetAttribute('vertex') -eq '1' -and $geo) {
                $w = ToD $geo.GetAttribute('width')
                $h = ToD $geo.GetAttribute('height')
                if ($w -le 0 -or $h -le 0) { continue }
                $fill = Get-StyleVal $style 'fillColor'
                $stroke = Get-StyleVal $style 'strokeColor'
                $dashed = Get-StyleVal $style 'dashed'
                $isLabel = ($style -match '(^|;)text;') -or (($fill -eq 'none') -and ($stroke -eq 'none'))
                $isContainer = (-not $isLabel) -and ($dashed -eq '1')
                $fsRaw = Get-StyleVal $style 'fontSize'
                $fs = if ($fsRaw) { ToD $fsRaw 12 } else { 12 }
                if ($fs -le 0) { $fs = 12 }
                $vertices.Add([pscustomobject]@{
                    Id = $id; Value = $value; Style = $style
                    X = (ToD $geo.GetAttribute('x')); Y = (ToD $geo.GetAttribute('y'))
                    W = $w; H = $h
                    IsLabel = $isLabel; IsContainer = $isContainer
                    FontSize = $fs
                    Wrap = ($style -match 'whiteSpace\s*=\s*wrap')
                    HasNewline = ($value -match "`n")
                })
            }
            elseif ($c.GetAttribute('edge') -eq '1') {
                $edges.Add([pscustomobject]@{
                    Id = $id
                    Source = $c.GetAttribute('source')
                    Target = $c.GetAttribute('target')
                })
            }
        }
        $pages.Add([pscustomobject]@{ Index = $i; Name = $name; Vertices = $vertices; Edges = $edges })
    }
    return $pages
}

# ---------- 几何 ----------

function Test-RectOverlap {
    # 返回相交矩形的宽高；负值表示不相交
    param($A, $B)
    $x1 = [Math]::Max($A.X, $B.X)
    $y1 = [Math]::Max($A.Y, $B.Y)
    $x2 = [Math]::Min($A.X + $A.W, $B.X + $B.W)
    $y2 = [Math]::Min($A.Y + $A.H, $B.Y + $B.H)
    return [pscustomobject]@{ W = ($x2 - $x1); H = ($y2 - $y1) }
}

function Test-Contains {
    # A 是否（在容差内）完全包含 B
    param($A, $B, [double]$Tol)
    return (($A.X - $Tol) -le $B.X) -and (($A.Y - $Tol) -le $B.Y) -and
           (($A.X + $A.W + $Tol) -ge ($B.X + $B.W)) -and
           (($A.Y + $A.H + $Tol) -ge ($B.Y + $B.H))
}

function Get-RectArea {
    param($R)
    return $R.W * $R.H
}

function Test-HSegCrossRect {
    param([double]$Y, [double]$X1, [double]$X2, $R, [double]$Tol)
    $lo = [Math]::Min($X1, $X2); $hi = [Math]::Max($X1, $X2)
    if ($Y -le ($R.Y + $Tol)) { return $false }
    if ($Y -ge ($R.Y + $R.H - $Tol)) { return $false }
    $ox = [Math]::Min($hi, $R.X + $R.W) - [Math]::Max($lo, $R.X)
    return ($ox -gt $Tol)
}

function Test-VSegCrossRect {
    param([double]$X, [double]$Y1, [double]$Y2, $R, [double]$Tol)
    $lo = [Math]::Min($Y1, $Y2); $hi = [Math]::Max($Y1, $Y2)
    if ($X -le ($R.X + $Tol)) { return $false }
    if ($X -ge ($R.X + $R.W - $Tol)) { return $false }
    $oy = [Math]::Min($hi, $R.Y + $R.H) - [Math]::Max($lo, $R.Y)
    return ($oy -gt $Tol)
}

# ---------- 主流程 ----------

$file = (Resolve-Path -LiteralPath $Path).Path
$pages = @(Read-Diagram -File $file)   # 必须 @()：函数返回 List，单页时会被拆成裸对象

$issues = New-Object System.Collections.Generic.List[object]
$pageStats = New-Object System.Collections.Generic.List[object]

foreach ($pg in $pages) {
    # 注意：$pg.Vertices / $pg.Edges 是 List[object]。用 @() 去包一个 List[object] 会抛
    # 「参数类型不匹配」（PS 5.1 的行为），所以这里必须 .ToArray()。
    $vs = $pg.Vertices.ToArray()
    $shapes = @($vs | Where-Object { -not $_.IsLabel -and -not $_.IsContainer })
    $containers = @($vs | Where-Object { $_.IsContainer })
    $found = 0

    # --- 1. 方框重叠（部分相交才算；完全包含 = 有意的叠放） ---
    for ($i = 0; $i -lt $shapes.Count; $i++) {
        for ($j = $i + 1; $j -lt $shapes.Count; $j++) {
            $A = $shapes[$i]; $B = $shapes[$j]
            $ov = Test-RectOverlap -A $A -B $B
            if ($ov.W -le $Tolerance -or $ov.H -le $Tolerance) { continue }
            if ((Test-Contains -A $A -B $B -Tol $Tolerance) -or (Test-Contains -A $B -B $A -Tol $Tolerance)) { continue }
            $issues.Add([pscustomobject]@{
                Page = $pg.Name; Kind = '方框重叠'
                Detail = ("'{0}' 与 '{1}' 相交 {2:N0}×{3:N0} px" -f $A.Id, $B.Id, $ov.W, $ov.H)
            })
            $found++
        }
    }

    # --- 2. 越出容器 ---
    foreach ($s in $shapes) {
        $sArea = Get-RectArea -R $s
        if ($sArea -le 0) { continue }
        $best = $null; $bestRatio = 0.0
        foreach ($c in $containers) {
            $ov = Test-RectOverlap -A $s -B $c
            if ($ov.W -le 0 -or $ov.H -le 0) { continue }
            $ratio = ($ov.W * $ov.H) / $sArea
            if ($ratio -gt $bestRatio) { $bestRatio = $ratio; $best = $c }
        }
        # 一大半在里面 → 认为它属于这个容器 → 要求完全在内
        if ($best -and $bestRatio -ge 0.6) {
            if (-not (Test-Contains -A $best -B $s -Tol $Tolerance)) {
                $overR = ($s.X + $s.W) - ($best.X + $best.W)
                $underL = $best.X - $s.X
                $overB = ($s.Y + $s.H) - ($best.Y + $best.H)
                $underT = $best.Y - $s.Y
                $parts = @()
                if ($overR -gt $Tolerance) { $parts += ("右侧超出 {0:N0}px" -f $overR) }
                if ($underL -gt $Tolerance) { $parts += ("左侧超出 {0:N0}px" -f $underL) }
                if ($overB -gt $Tolerance) { $parts += ("下方超出 {0:N0}px" -f $overB) }
                if ($underT -gt $Tolerance) { $parts += ("上方超出 {0:N0}px" -f $underT) }
                $issues.Add([pscustomobject]@{
                    Page = $pg.Name; Kind = '越出容器'
                    Detail = ("'{0}' 属于容器 '{1}'，但 {2}" -f $s.Id, $best.Id, ($parts -join '，'))
                })
                $found++
            }
        }
    }

    # --- 3. 连线穿框 ---
    $byId = @{}
    foreach ($v in $vs) { $byId[$v.Id] = $v }
    foreach ($e in $pg.Edges.ToArray()) {
        if (-not $e.Source -or -not $e.Target) { continue }
        if (-not $byId.ContainsKey($e.Source) -or -not $byId.ContainsKey($e.Target)) { continue }
        $S = $byId[$e.Source]; $T = $byId[$e.Target]
        if ($S.IsLabel -or $T.IsLabel) { continue }
        if ($S.IsContainer -or $T.IsContainer) { continue }

        $sx = $S.X + $S.W / 2; $sy = $S.Y + $S.H
        $tx = $T.X + $T.W / 2; $ty = $T.Y
        # 目标在上方时翻转
        if ($ty -lt $sy) { $ty = $T.Y + $T.H; $sy = $S.Y }
        $midY = ($sy + $ty) / 2

        $crossers = New-Object System.Collections.Generic.List[string]
        foreach ($o in $shapes) {
            if ($o.Id -eq $S.Id -or $o.Id -eq $T.Id) { continue }
            $hit = $false
            # 段1：source 竖直出去
            if (Test-VSegCrossRect -X $sx -Y1 $sy -Y2 $midY -R $o -Tol $Tolerance) { $hit = $true }
            # 段2：横移
            if (-not $hit -and (Test-HSegCrossRect -Y $midY -X1 $sx -X2 $tx -R $o -Tol $Tolerance)) { $hit = $true }
            # 段3：竖直进入 target
            if (-not $hit -and (Test-VSegCrossRect -X $tx -Y1 $midY -Y2 $ty -R $o -Tol $Tolerance)) { $hit = $true }
            if ($hit) { $crossers.Add($o.Id) }
        }
        if ($crossers.Count -gt 0) {
            $issues.Add([pscustomobject]@{
                Page = $pg.Name; Kind = '连线穿框'
                Detail = ("边 '{0}'（{1} → {2}）穿过 {3}" -f $e.Id, $e.Source, $e.Target, (($crossers | Select-Object -Unique) -join ', '))
            })
            $found++
        }
    }

    # --- 4. 文字溢出 ---
    foreach ($v in $vs) {
        if (-not $v.Value) { continue }
        $avail = $v.W - 16
        if ($avail -le 0) { continue }
        $lines = @($v.Value -split "`n")
        if ($v.Wrap) {
            # 能换行：看竖着放得下几行
            $needLines = 0
            foreach ($ln in $lines) {
                $lw = Get-TextWidth -Text $ln -FontSize $v.FontSize
                $needLines += [Math]::Max(1, [Math]::Ceiling($lw / $avail))
            }
            $needH = $needLines * $v.FontSize * 1.45
            if ($needH -gt ($v.H - 8)) {
                $issues.Add([pscustomobject]@{
                    Page = $pg.Name; Kind = '文字溢出'
                    Detail = ("'{0}' 需 {1} 行（约 {2:N0}px 高），方框只有 {3:N0}px：{4}" -f `
                        $v.Id, $needLines, $needH, $v.H, ($v.Value -replace "`n", ' / '))
                })
                $found++
            }
        } else {
            foreach ($ln in $lines) {
                $lw = Get-TextWidth -Text $ln -FontSize $v.FontSize
                if ($lw -gt $avail * 1.05) {
                    $pct = [Math]::Round(($lw / $avail - 1) * 100)
                    $issues.Add([pscustomobject]@{
                        Page = $pg.Name; Kind = '文字溢出'
                        Detail = ("'{0}' 文字约 {1:N0}px，可用 {2:N0}px（超 {3}%）：{4}" -f `
                            $v.Id, $lw, $avail, $pct, $ln)
                    })
                    $found++
                }
            }
        }
    }

    $pageStats.Add([pscustomobject]@{
        Index = $pg.Index; Name = $pg.Name
        Shapes = $shapes.Count; Containers = $containers.Count
        Edges = $pg.Edges.Count; Issues = $found
    })
}

# ---------- 报告 ----------

if (-not $Quiet) {
    Write-Host ""
    Write-Host ("布局体检：{0}" -f $file) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  页  Id/名称                     形状  容器  连线  问题"
    Write-Host "  --  --------------------------  ----  ----  ----  ----"
    foreach ($s in $pageStats) {
        $color = if ($s.Issues -gt 0) { 'Yellow' } else { 'Green' }
        Write-Host ("  {0,-2}  {1,-26}  {2,-4}  {3,-4}  {4,-4}  {5}" -f `
            $s.Index, $s.Name, $s.Shapes, $s.Containers, $s.Edges, $s.Issues) -ForegroundColor $color
    }
    Write-Host ""

    if ($issues.Count -eq 0) {
        Write-Host "没有发现布局问题。" -ForegroundColor Green
    } else {
        $kinds = @('方框重叠', '越出容器', '连线穿框', '文字溢出')
        foreach ($k in $kinds) {
            $sub = @($issues | Where-Object { $_.Kind -eq $k })
            if ($sub.Count -eq 0) { continue }
            Write-Host ("  [{0}] {1} 处" -f $k, $sub.Count) -ForegroundColor Yellow
            foreach ($it in $sub) {
                Write-Host ("    · [{0}] {1}" -f $it.Page, $it.Detail) -ForegroundColor Gray
            }
            Write-Host ""
        }
        Write-Host ("合计 {0} 处。注意：文字溢出是**估算**，超一点点可以放过；" -f $issues.Count) -ForegroundColor DarkGray
        Write-Host "     但连线穿框和越出容器基本都该改。" -ForegroundColor DarkGray
    }
    Write-Host ""
} else {
    if ($issues.Count -gt 0) {
        Write-Host ("布局体检未通过：{0} 处问题（{1}）" -f $issues.Count, $file) -ForegroundColor Red
    } else {
        Write-Host ("布局体检通过：{0}" -f $file) -ForegroundColor Green
    }
}

if ($issues.Count -gt 0) { exit 1 }
exit 0
