---
name: drawio
description: "生成、修改、导出与体检 draw.io / diagrams.net 图表。用 JSON 规格或手写 mxGraphModel XML 生成 .drawio（架构图、流程图、ER 图、产品界面示意图），用本机 draw.io CLI 批量导出 PNG/SVG/PDF，并在导出前用布局体检抓出方框重叠、越出容器、连线穿框、文字溢出四类缺陷。Triggers：「画个架构图」「生成 drawio」「导出 drawio」「draw.io 转 png」「diagrams.net」「这图排版有问题」；draw.io, drawio, diagrams.net, architecture diagram, export diagram to png, mxGraphModel."
whenToUse: "用户要画或修改架构图、流程图、ER 图、产品界面示意图，要生成 .drawio 文件，要把 .drawio 导出成 PNG/SVG/PDF，或要检查已有图表排版有无重叠、越界、连线穿框、文字溢出。Also when the user wants to create or edit a draw.io / diagrams.net diagram, generate a .drawio file, export it to an image, or check a diagram's layout."
---

> Language note: this instruction body is written in Chinese. The frontmatter `description` above is
> bilingual so the skill is discoverable in both languages. An English body is welcome as a
> contribution — see [CONTRIBUTING.md](../../CONTRIBUTING.md).

# draw.io 图表

**能用文本生成、能批量导出、能在导出前自查排版。**

图表的价值在于「一眼看懂」。方框重叠、连线穿过别的方框、文字挤出边框，这三种毛病不会让文件打不开，
但会让图变成废话——而且**只看 XML 是看不出来的**，必须真的渲染出来看。这个技能把「渲染」和「检查」
都做成了可重复执行的脚本。

## 先判断要做哪件事

| 用户想要 | 走哪条 | 副作用 | 需要 draw.io 桌面版 |
|---|---|---|---|
| 「画个架构图 / 流程图」「生成 .drawio」 | **A 生成** | 写文件 | 不需要 |
| 「导出成 PNG / SVG / PDF」「转成图片」 | **B 导出** | 写文件 | **需要** |
| 「这图排版有没有问题」「帮我检查一下」 | **C 体检** | 无（只读） | 不需要 |

**生成和体检都是纯 XML 操作，不依赖 draw.io。** 只有导出需要 CLI。
所以即使机器上没装 draw.io，A 和 C 照样能做——只是没法把图渲出来看。

---

## 铁律：三个已实测的坑

这三条都是本机 draw.io **30.2.4** 上实测出来的，不是从文档抄的。踩中任何一条都不会报错，
只会**安静地给你错的东西**——所以必须当纪律守。

### 1. `--page-index` 是 **1-based**，而索引 `0` 会**静默回落**到第 1 页

实测：一个两页的 `.drawio`，逐页导出后对比字节。

| `--page-index` | 产物字节数 | 实际导出的是哪一页 |
|---|---|---|
| `0` | 330,806 | 第 1 页（系统架构图） |
| `1` | 330,806 | 第 1 页（系统架构图） |
| `2` | 375,304 | 第 2 页（产品界面效果图） |

**危险点**：`0` 不报错、不警告、退出码 0，直接给你第 1 页。
所以「习惯性从 0 开始循环」会安静地导出 N 份第 1 页——你只有在打开图对比时才发现。

**永远用 `1..N`。**

### 2. `--all-pages` 在 PNG 导出上**无效**（30.2.4 实测）

```
--all-pages PNG  exit=0
  pg.png              330806 bytes      ← 只有第 1 页，第 2 页根本没生成
```

加了 `--all-pages` 也只产出 1 个文件，内容等于第 1 页。**多页导 PNG 必须自己 `for` 循环 `--page-index`。**

（`--format svg` 是例外：SVG 支持把多页写进一个文件，那条路径可用，见 `references/02-CLI导出.md`。）

### 3. CLI 是 Electron 进程：**退出 ≠ 文件写完**

连续两次 `& $drawio --export ...` 时，第二次会被第一次尚未退干净的实例吞掉，产出上一页的内容。
必须两道都做——**串行等进程退出，再轮询等文件落盘**：

```powershell
$pr = Start-Process -FilePath $drawio -ArgumentList $argl -Wait -PassThru -WindowStyle Hidden
# 不要以为到这里文件就有了，继续轮询
```

`scripts/Export-Drawio.ps1` 已经把这三条都封好了。**优先用它，别自己拼命令行。**

---

## 找 draw.io：别用 `InstallLocation`

本机实测的注册表内容：

```
DisplayName     : draw.io 30.2.4
InstallLocation : (空)                                     ← 靠它探测必定失败
DisplayIcon     : D:\Program Files\Draw.io\draw.io.exe,0    ← 只能靠这个
```

`InstallLocation` 是空的，PATH 里也没有，App Paths 项也没有——所以 `drawio` 这个命令根本敲不出来。
可靠来源是 `DisplayIcon`，而且**末尾的 `,0` 是图标索引，必须剥掉**：

```powershell
($_.DisplayIcon -replace ',\d+$','')
```

`Export-Drawio.ps1` 的探测顺序：
App Paths → `Get-Command` → 注册表 `InstallLocation` → 注册表 `DisplayIcon`（剥 `,0`）→ 常见安装路径。

---

## 快速开始

```powershell
# A. 从 JSON 规格生成 .drawio（自动布局，不会重叠）
.\scripts\New-Drawio.ps1 -Spec .\架构.json -Out .\架构.drawio

# C. 导出前先体检（只读，不碰你的文件）
.\scripts\Test-DrawioLayout.ps1 -Path .\架构.drawio

# B. 逐页导出（自动数页数、自动按 1-based 循环）
.\scripts\Export-Drawio.ps1 -Path .\架构.drawio -OutDir .\out -Format png -Scale 2
```

**推荐顺序是 A → C → B**：先体检再导出。体检发现问题就改，别导出一堆有毛病的图。

---

## 脚本

| 脚本 | 做什么 | 关键参数 |
|---|---|---|
| `scripts/New-Drawio.ps1` | 从 JSON 规格生成 `.drawio`，分层自动布局 | `-Spec` `-Out` `-Force` |
| `scripts/Export-Drawio.ps1` | 逐页导出 PNG / SVG / PDF | `-Path` `-OutDir` `-Format` `-Scale` `-Pages` |
| `scripts/Test-DrawioLayout.ps1` | 布局体检，四类缺陷 | `-Path` `-Tolerance` `-Quiet` |

三个脚本都是**默认安全**的：`Export` 只在 `-OutDir` 里写产物，`Test-DrawioLayout` 完全不写文件。
`New-Drawio.ps1` 覆盖已有文件需要显式 `-Force`。

### 体检能查出什么

| 缺陷 | 为什么肉眼容易漏 | 后果 |
|---|---|---|
| **方框重叠** | 图一复杂就看不出来 | 两个模块挤在一起，像是一体的 |
| **越出容器** | 差几个像素，缩略图上完全看不见 | 模块看起来不属于任何一层 |
| **连线穿框** | 正交连线会「抄近路」横穿中间方框 | 看不懂连线到底连的是谁 |
| **文字溢出** | 只有特定字体/字号下才挤出边框 | 字被裁掉或压住边框 |

详见 `references/03-布局体检.md`。

---

## 参考文档（按需加载，不要一次全读）

| 文件 | 什么时候读 |
|---|---|
| `references/01-文件格式.md` | 要手写或读懂 mxGraphModel XML、要改样式、要处理多页与压缩格式 |
| `references/02-CLI导出.md` | 要改导出参数、要导 PDF/SVG、遇到导出异常 |
| `references/03-布局体检.md` | 体检报了问题要修、或想理解四类缺陷的成因与修法 |

---

## 几条经验

1. **坐标是绝对像素，不是相对父容器的。** `mxGeometry` 的 x/y 相对的是**父 cell**，
   但绝大多数情况下 `parent="1"`（也就是相对画布左上角）。把「层级容器」和「层里的方框」
   都挂在 `parent="1"` 上是最省心的做法——容器只负责画个虚线框，不参与坐标计算。
   一旦真的用父子嵌套，坐标含义立刻变成相对的，极易算错。见 `references/01-文件格式.md`。

2. **换行用 `&#10;`。** 在 `value` 属性里写字面换行会被 XML 折叠掉。draw.io 认的是 `&#10;`。

3. **正交连线会横穿中间的方框。** 这是 draw.io 的默认行为，不是 bug。
   同一行上 A 连 C，路由会直接从 B 身上压过去。修法是用 `exitX/exitY/entryX/entryY`
   指定出入边，或者显式加 `mxPoint` 拐点。体检脚本会把这类问题点名报出来。

4. **CJK 字体宽度约等于 `fontSize`。** 估算文字是否放得下时，中文字符按 `1.0 × fontSize`、
   ASCII 按 `0.55 × fontSize` 算，和实测结果比较接近。体检脚本用的就是这个系数。

5. **`.ps1` 在这个仓库必须有 UTF-8 BOM，`SKILL.md` 必须没有。**
   改完文件跑一遍 `..\..\scripts\Fix-Bom.ps1`。
