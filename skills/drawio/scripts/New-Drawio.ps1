<#
  New-Drawio.ps1 —— 从 JSON 规格生成 .drawio（分层自动布局）
  ------------------------------------------------------------------
  为什么需要它：

    手算坐标是布局缺陷的头号来源。同一行放 5 个方框，间距算错一个就往回压，
    于是方框重叠；容器改小了内容没跟着改，于是越出容器。这些错**肉眼看缩略图
    根本发现不了**。

    所以这个脚本不让你写坐标，只让你写**结构**：哪些层、每层有哪些模块、
    谁连谁。横向位置由「层内等分」算出来，从数学上排除重叠与越界。

  布局规则：
    - 画布左右各留 40，分层容器宽度 = pageWidth - 80
    - 每层左边留 labelWidth 竖排层名，右边留 20
    - 层内 N 个模块等分剩余宽度，模块间距固定 gap
    - 模块垂直居中于所在层
    - 层与层之间留 layerGap

  用法：
    .\New-Drawio.ps1 -Spec .\架构.json -Out .\架构.drawio
    .\New-Drawio.ps1 -Spec .\架构.json -Out .\架构.drawio -Force
    .\New-Drawio.ps1 -Spec .\架构.json -Out .\架构.drawio -ThenTest

  规格格式见 .\examples\sample-architecture.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Spec,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Out,

    [switch]$Force,
    [switch]$ThenTest
)

$ErrorActionPreference = 'Stop'

# ---------- 工具 ----------

function Get-Prop {
    param($Obj, [string]$Name, $Default = $null)
    if ($null -eq $Obj) { return $Default }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p) { return $Default }
    if ($null -eq $p.Value) { return $Default }
    if ($p.Value -is [string] -and $p.Value -eq '') { return $Default }
    return $p.Value
}

function ConvertTo-XmlText {
    param([string]$S)
    if ($null -eq $S) { return '' }
    $S = $S -replace '&', '&amp;'
    $S = $S -replace '<', '&lt;'
    $S = $S -replace '>', '&gt;'
    $S = $S -replace '"', '&quot;'
    # 属性里的换行必须写成字符引用，写字面换行会被 XML 折叠成空格
    $S = $S -replace "`r`n", "`n"
    $S = $S -replace "`n", '&#10;'
    return $S
}

function New-TextCell {
    param([string]$Id, [string]$Text, [double]$X, [double]$Y, [double]$W, [double]$H,
          [double]$FontSize, [string]$Color, [int]$FontStyle, [string]$Align, [int]$Horizontal)
    $style = "text;html=1;align=$Align;verticalAlign=middle;fillColor=none;strokeColor=none;" +
             "overflow=visible;fontSize=$FontSize;fontStyle=$FontStyle;fontColor=$Color;"
    if ($Horizontal -eq 0) { $style += 'horizontal=0;' }
    return @"
        <mxCell id="$Id" value="$(ConvertTo-XmlText $Text)" style="$style" vertex="1" parent="1"><mxGeometry x="$X" y="$Y" width="$W" height="$H" as="geometry" /></mxCell>
"@
}

# ---------- 主流程 ----------

$specPath = (Resolve-Path -LiteralPath $Spec).Path
$json = Get-Content -LiteralPath $specPath -Raw -Encoding UTF8 | ConvertFrom-Json

$outFull = [System.IO.Path]::GetFullPath($Out)
if ((Test-Path -LiteralPath $outFull) -and (-not $Force)) {
    Write-Host ("输出文件已存在：{0}" -f $outFull) -ForegroundColor Red
    Write-Host "  要覆盖请加 -Force。这样设计是为了避免手一抖把改好的图覆盖掉。" -ForegroundColor Yellow
    exit 1
}

$pageSpecs = @(Get-Prop $json 'pages')
if ($pageSpecs.Count -eq 0) {
    # 也允许顶层直接就是一个页面对象
    if (Get-Prop $json 'layers') { $pageSpecs = @($json) }
    else { Write-Host "规格里没有 pages（也没有 layers）：$specPath" -ForegroundColor Red; exit 1 }
}

$margin     = 40.0
$layerGap   = 18.0
$itemGap    = 20.0
$titleH     = 42.0
$titleTop   = 20.0
$firstLayerY = 80.0

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<mxfile host="app.diagrams.net" agent="DSH" type="device">')

$pageNo = 0
foreach ($pg in $pageSpecs) {
    $pageNo++
    $pageName = [string](Get-Prop $pg 'name' "page$pageNo")
    $pageId   = [string](Get-Prop $pg 'id' "p$pageNo")
    $title    = Get-Prop $pg 'title' $null
    $pageW    = [double](Get-Prop $pg 'pageWidth' 1400)
    $labelW   = [double](Get-Prop $pg 'labelWidth' 120)
    $defItemH = [double](Get-Prop $pg 'itemHeight' 70)
    $defFill  = [string](Get-Prop $pg 'fill' '#dae8fc')
    $defStroke= [string](Get-Prop $pg 'stroke' '#6c8ebf')

    $layers = @(Get-Prop $pg 'layers' @())
    if ($layers.Count -eq 0) { Write-Host ("页 '{0}' 没有任何 layers" -f $pageName) -ForegroundColor Red; exit 1 }

    $containerX = $margin
    $containerW = $pageW - $margin * 2
    $innerLeft  = $containerX + $labelW
    $innerW     = $containerW - $labelW - 20

    # 先排纵向
    $rows = New-Object System.Collections.Generic.List[object]
    $y = $firstLayerY
    foreach ($ly in $layers) {
        $h = [double](Get-Prop $ly 'height' 120)
        $rows.Add([pscustomobject]@{ Spec = $ly; Y = $y; H = $h })
        $y += $h + $layerGap
    }
    $contentBottom = $y - $layerGap
    $pageH = [double](Get-Prop $pg 'pageHeight' ($contentBottom + 40))

    [void]$sb.AppendLine(('  <diagram id="{0}" name="{1}">' -f $pageId, (ConvertTo-XmlText $pageName)))
    [void]$sb.AppendLine(('    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{0}" pageHeight="{1}" math="0" shadow="0">' -f $pageW, $pageH))
    [void]$sb.AppendLine('      <root>')
    [void]$sb.AppendLine('        <mxCell id="0" />')
    [void]$sb.AppendLine('        <mxCell id="1" parent="0" />')

    if ($title) {
        [void]$sb.AppendLine((New-TextCell -Id 'title' -Text $title -X $margin -Y $titleTop -W $containerW -H $titleH `
            -FontSize 24 -Color '#0f172a' -FontStyle 1 -Align 'left' -Horizontal 1))
    }

    $idMap = @{}      # 模块 id -> 几何
    $layerIdx = 0

    foreach ($row in $rows) {
        $ly = $row.Spec
        $layerIdx++
        $items = @(Get-Prop $ly 'items' @())
        $n = $items.Count
        $fill   = [string](Get-Prop $ly 'fill' $defFill)
        $stroke = [string](Get-Prop $ly 'stroke' $defStroke)
        $label  = [string](Get-Prop $ly 'label' '')

        $cId = "layer$layerIdx"
        $cStyle = "rounded=1;arcSize=4;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;" +
                  "fillColor=none;strokeColor=#cbd5e1;dashed=1;dashPattern=8 4;"
        [void]$sb.AppendLine(('        <mxCell id="{0}" value="" style="{1}" vertex="1" parent="1"><mxGeometry x="{2}" y="{3}" width="{4}" height="{5}" as="geometry" /></mxCell>' -f `
            $cId, $cStyle, $containerX, $row.Y, $containerW, $row.H))

        if ($label) {
            [void]$sb.AppendLine((New-TextCell -Id "${cId}_label" -Text $label -X ($containerX + 10) -Y $row.Y `
                -W ($labelW - 10) -H $row.H -FontSize 14 -Color '#475569' -FontStyle 1 -Align 'center' -Horizontal 0))
        }

        if ($n -eq 0) { continue }

        $itemW = ($innerW - $itemGap * ($n - 1)) / $n
        if ($itemW -le 20) {
            Write-Host ("层 '{0}' 有 {1} 个模块，分下来每个只有 {2:N0}px，太窄了。" -f $label, $n, $itemW) -ForegroundColor Red
            Write-Host "  减少模块数，或者把 pageWidth 调大，或者减少 labelWidth。" -ForegroundColor Yellow
            exit 1
        }
        $itemH = [double](Get-Prop $ly 'itemHeight' $defItemH)
        $itemY = $row.Y + ($row.H - $itemH) / 2

        for ($i = 0; $i -lt $n; $i++) {
            $it = $items[$i]
            $iid = [string](Get-Prop $it 'id' ("${cId}_i$i"))
            $txt = [string](Get-Prop $it 'text' $iid)
            $ix  = $innerLeft + $i * ($itemW + $itemGap)
            $ifill   = [string](Get-Prop $it 'fill' $fill)
            $istroke = [string](Get-Prop $it 'stroke' $stroke)

            if ($idMap.ContainsKey($iid)) {
                Write-Host ("模块 id 重复：'{0}'。id 必须唯一，边靠它引用。" -f $iid) -ForegroundColor Red
                exit 1
            }
            $idMap[$iid] = [pscustomobject]@{ X = $ix; Y = $itemY; W = $itemW; H = $itemH }

            $st = "rounded=1;arcSize=8;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;" +
                  "fontSize=13;fontColor=#0f172a;fillColor=$ifill;strokeColor=$istroke;"
            [void]$sb.AppendLine(('        <mxCell id="{0}" value="{1}" style="{2}" vertex="1" parent="1"><mxGeometry x="{3}" y="{4}" width="{5}" height="{6}" as="geometry" /></mxCell>' -f `
                $iid, (ConvertTo-XmlText $txt), $st, $ix, $itemY, $itemW, $itemH))
        }
    }

    # ---- 边 ----
    $edges = @(Get-Prop $pg 'edges' @())
    $eNo = 0
    foreach ($e in $edges) {
        $from = [string](Get-Prop $e 'from' '')
        $to   = [string](Get-Prop $e 'to' '')
        if (-not $from -or -not $to) {
            Write-Host "有一条边缺 from 或 to" -ForegroundColor Red; exit 1
        }
        foreach ($chk in @($from, $to)) {
            if (-not $idMap.ContainsKey($chk)) {
                Write-Host ("边引用了不存在的模块 id：'{0}'" -f $chk) -ForegroundColor Red
                Write-Host ("  可用的 id：{0}" -f (($idMap.Keys | Sort-Object) -join ', ')) -ForegroundColor Yellow
                exit 1
            }
        }
        $eNo++
        $eid = [string](Get-Prop $e 'id' "e$eNo")
        $elabel = [string](Get-Prop $e 'label' '')

        # 默认从下边出、从上边进 —— 这样同一行的兄弟模块不会被横穿的线压到
        $est = "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;" +
               "strokeColor=#64748b;strokeWidth=1.5;exitX=0.5;exitY=1;exitDx=0;exitDy=0;" +
               "entryX=0.5;entryY=0;entryDx=0;entryDy=0;"
        if ($elabel) { $est += 'labelBackgroundColor=#ffffff;' }

        $wps = @(Get-Prop $e 'waypoints' @())
        if ($wps.Count -gt 0) {
            $pts = ($wps | ForEach-Object {
                ('          <mxPoint x="{0}" y="{1}" />' -f (Get-Prop $_ 'x' 0), (Get-Prop $_ 'y' 0))
            }) -join "`n"
            [void]$sb.AppendLine(('        <mxCell id="{0}" value="{1}" style="{2}" edge="1" parent="1" source="{3}" target="{4}">' -f `
                $eid, (ConvertTo-XmlText $elabel), $est, $from, $to))
            [void]$sb.AppendLine('          <mxGeometry relative="1" as="geometry">')
            [void]$sb.AppendLine('            <Array as="points">')
            [void]$sb.AppendLine($pts)
            [void]$sb.AppendLine('            </Array>')
            [void]$sb.AppendLine('          </mxGeometry>')
            [void]$sb.AppendLine('        </mxCell>')
        } else {
            [void]$sb.AppendLine(('        <mxCell id="{0}" value="{1}" style="{2}" edge="1" parent="1" source="{3}" target="{4}"><mxGeometry relative="1" as="geometry" /></mxCell>' -f `
                $eid, (ConvertTo-XmlText $elabel), $est, $from, $to))
        }
    }

    [void]$sb.AppendLine('      </root>')
    [void]$sb.AppendLine('    </mxGraphModel>')
    [void]$sb.AppendLine('  </diagram>')

    Write-Host ("  页 {0}: {1} —— {2} 层，{3} 个模块，{4} 条边" -f `
        $pageNo, $pageName, $layers.Count, $idMap.Count, $eNo) -ForegroundColor Cyan
}

[void]$sb.AppendLine('</mxfile>')

$outDir = Split-Path -Parent $outFull
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}
# UTF-8 无 BOM —— XML 默认就是 UTF-8，加了 BOM 反而多三个字节给解析器添乱
[System.IO.File]::WriteAllText($outFull, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host ("已生成：{0}  ({1:N0} bytes)" -f $outFull, (Get-Item -LiteralPath $outFull).Length) -ForegroundColor Green

if ($ThenTest) {
    $tester = Join-Path $PSScriptRoot 'Test-DrawioLayout.ps1'
    Write-Host ""
    & $tester -Path $outFull
    exit $LASTEXITCODE
}
exit 0
