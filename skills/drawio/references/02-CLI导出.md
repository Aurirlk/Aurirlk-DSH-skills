# draw.io CLI 导出

draw.io 桌面版自带命令行导出，**不需要图形界面、不需要打开窗口**，脚本里可以直接调。

## 先找到可执行文件

本机实测的注册表内容（`draw.io 30.2.4`）：

```
DisplayName     : draw.io 30.2.4
InstallLocation : (空)                                     ← 空的！靠它探测必定失败
DisplayIcon     : D:\Program Files\Draw.io\draw.io.exe,0
```

所以探测顺序应该是：

1. `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\draw.io.exe` 的默认值
2. `Get-Command drawio`（万一用户自己加进 PATH 了）
3. 注册表 `InstallLocation` + `draw.io.exe`
4. **注册表 `DisplayIcon`，剥掉末尾的 `,\d+`**
5. 常见安装路径兜底

第 4 条是关键，`InstallLocation` 在本机是空的。剥图标索引：

```powershell
($_.DisplayIcon -replace ',\d+$','')
```

本机 PATH 里没有、App Paths 里也没有，所以 `drawio` 敲不出来，**必须用绝对路径**。
`scripts/Export-Drawio.ps1` 已经按上面五步探测，直接用就行。

## 基本命令

```powershell
$drawio = 'D:\Program Files\Draw.io\draw.io.exe'
$src    = '.\架构.drawio'
$out    = '.\out\架构.png'

Start-Process -FilePath $drawio -ArgumentList @(
  '--export', '--format', 'png', '--scale', '2', '--border', '10',
  '--page-index', '1', '--output', $out, $src
) -Wait -NoNewWindow
```

## 三个必知的坑

### 坑 1：`--page-index` 是 1-based，`0` 静默回落到第 1 页

实测（两页的 `.drawio`，逐页导出比字节）：

| `--page-index` | 字节数 | 实际页 |
|---|---|---|
| `0` | 330,806 | 第 1 页 |
| `1` | 330,806 | 第 1 页 |
| `2` | 375,304 | 第 2 页 |

**退出码永远是 0，没有任何警告。** 从 0 开始循环 = 安静地导出 N 份第 1 页。

```powershell
# 对
for ($i = 1; $i -le $pageCount; $i++) { … }
# 错 —— 不报错，但每份都是第 1 页
for ($i = 0; $i -lt $pageCount; $i++) { … }
```

### 坑 2：`--all-pages` 在 PNG 上无效

```
--all-pages PNG  exit=0
  pg.png              330806 bytes     ← 只有第 1 页
```

30.2.4 上 `--all-pages` 配 PNG 只出一页。**多页导 PNG 必须自己循环 `--page-index`。**

`--format svg` 是例外，多页会写进**一个** SVG 文件（实测 528,735 字节，含两页），那条路可用。

### 坑 3：Electron 进程退出 ≠ 文件写完

`&` 调用会过早返回；连续两次导出时，第二次可能被第一次没退干净的实例吞掉，
结果第二页的文件里是第一页的内容。**两道都要做**：

```powershell
# 第一道：等进程退出
$pr = Start-Process -FilePath $drawio -ArgumentList $argl -Wait -PassThru -WindowStyle Hidden

# 第二道：轮询等文件真的落盘
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $out) { break }
    Start-Sleep -Milliseconds 400
}
```

更稳的做法是**每页用独立的输出目录**，彻底避免实例之间互相干扰。

## 参数表

| 参数 | 说明 |
|---|---|
| `--export` | 声明这是导出操作，必须有 |
| `--format` | `png` / `svg` / `pdf` / `jpg` / `xml` / `html` |
| `--output` | 输出文件路径 |
| `--page-index N` | 选页，**1-based** |
| `--all-pages` | 多页（PNG 上实测无效，SVG 可用） |
| `--scale N` | 缩放倍数。`2` 出高清图，`1` 是原始像素 |
| `--border N` | 四周留白像素，`10` 比较好看 |
| `--width N` | 按宽度导出（与 `--scale` 二选一） |
| `--height N` | 按高度导出 |
| `--crop` | 裁掉内容以外的空白（默认就对内容裁切） |
| `--transparent` | 透明背景，做 PPT 时有用 |
| `--theme dark` | 深色主题 |
| `--embed-svg-images` | SVG 内嵌图片 |

最后那个 `.drawio` 输入路径一定放**最后**，位置不能乱。

## 数页数

导出前得知道有几页。直接解析 XML：

```powershell
[xml]$x = Get-Content -LiteralPath $src -Raw -Encoding UTF8
$pages = @($x.mxfile.diagram)          # 注意 @() —— 单页时它不是数组，加 @() 才安全
$pages.Count
```

`@()` 不是可有可无的：**只有一页时 `$x.mxfile.diagram` 是单个 XmlElement，`.Count` 会给你
让人意外的结果**。所有「可能是 1 个也可能是 N 个」的地方都要包 `@()`。

压缩格式的 `.drawio` 也能这样数——`<diagram>` 本身还在，只是里面的内容被压了。

## 加载中文字体

导出时文字变方框（tofu，「缺字形」），通常是字体没被 draw.io 找到。本机实测：
同一个 `.drawio`，脚本用 matplotlib 直接画的版本出现了 `▾` 变方框，
而 draw.io CLI 导出的版本字符正常——**说明 draw.io 自身的字体栈更可靠，出图优先走 CLI。**

如果确实遇到 tofu：

- 指定字体：在 style 里加 `fontFamily=Microsoft YaHei`（中文）/ `Consolas`（等宽）
- 避开生僻符号：`▾` `▪` `⚡` 这类字符最容易缺字形，能用 ASCII 就用 ASCII
- `--format svg` 把文字保留为文本，字体问题可以事后在矢量编辑里改

## 常见异常

| 现象 | 原因 | 处理 |
|---|---|---|
| 退出码 0 但没文件 | 轮询不够久，或输出目录不存在 | 先 `New-Item -ItemType Directory -Force`，再轮询 |
| 导出的内容和上一页一样 | 坑 1（索引 0）或坑 3（实例被吞） | 用 `1..N`，用 `Start-Process -Wait` |
| 只有第 1 页 | 用了 `--all-pages` | 自己循环 `--page-index` |
| 中文变方框 | 字体缺失 | style 里指定 `fontFamily` |
| 命令行无任何输出 | 它是 GUI 子系统程序，`--help` 不打印 | 别依赖 `--help`，看本文档 |
| 图被裁掉一块 | 内容超出 `pageWidth/pageHeight` | 调大 `pageWidth`，或用 `--crop` |

## 一次性导全套

`scripts/Export-Drawio.ps1` 把这些都封好了：

```powershell
# 逐页导 PNG，2 倍分辨率，产物放 .\out
.\scripts\Export-Drawio.ps1 -Path .\架构.drawio -OutDir .\out -Format png -Scale 2

# 只导第 2 页
.\scripts\Export-Drawio.ps1 -Path .\架构.drawio -OutDir .\out -Pages 2

# 导一个含所有页的 SVG
.\scripts\Export-Drawio.ps1 -Path .\架构.drawio -OutDir .\out -Format svg -AllPages

# 只看有几页、用了哪个 drawio.exe，不导出
.\scripts\Export-Drawio.ps1 -Path .\架构.drawio -ListPages
```
