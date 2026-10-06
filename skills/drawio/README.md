# drawio · draw.io 图表生成与体检

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

> 给 AI agent 用的 draw.io 图表技能，三条线：
> **①生成**：用 JSON 规格生成 `.drawio`，分层自动布局，不写坐标
> **②导出**：逐页导出 PNG / SVG / PDF
> **③体检**：导出前查出方框重叠、越出容器、连线穿框、文字溢出
>
> 同时是 DSH 插件（`dsh.bundle.patch`）和通用 agent skill（`SKILL.md`）。

---

## 它解决什么问题

用 agent 画架构图，最常见的失败不是「画不出来」，而是**画出来了但排版是坏的**：

- 方框重叠，两个模块挤在一起像是一体的
- 模块探出分层容器的边框
- 正交连线「抄近路」，横穿中间的方框 —— 看不出连线到底连的是谁
- 文字挤出边框，被裁掉一截

这四类**都不会让文件出错**，`.drawio` 照样能打开、能导出。它们只会让图变成废话。
而且**肉眼看缩略图基本发现不了**：差几个像素的越界在 20% 缩放下完全看不见，
密集区域里两个框重叠反而像是「一组」。

drawio 技能的做法：

1. **不让你写坐标**——只写结构（哪些层、每层有哪些模块、谁连谁），横向位置由层内等分算出来，
   从数学上排除重叠与越界
2. **导出前先体检**——把「肉眼容易漏的地方」用几何算一遍，点名报出来
3. **把 CLI 的坑封死**——draw.io 的命令行有三个不报错但给错东西的行为，脚本里全堵上了
4. **产物哈希自检**——如果两页导出的字节完全相同，那几乎一定踩坑了，直接告警

## 三条线

| 用户想要 | 走哪条 | 副作用 | 需要 draw.io 桌面版 |
|---|---|---|---|
| 「画个架构图 / 流程图」 | **生成** | 写文件 | 不需要 |
| 「导出成 PNG / SVG / PDF」 | **导出** | 写文件 | **需要** |
| 「这图排版有问题吗」 | **体检** | 无（只读） | 不需要 |

生成与体检都是纯 XML 操作。**所以没装 draw.io 也能生成和检查**，只是没法把图渲出来看。

## 三个脚本

| 脚本 | 干什么 | 副作用 |
|---|---|---|
| `New-Drawio.ps1` | 从 JSON 规格生成 `.drawio`，分层自动布局 | 写文件（覆盖需 `-Force`） |
| `Export-Drawio.ps1` | 逐页导出 PNG / SVG / PDF，自动探测 draw.io 位置 | 只写 `-OutDir` |
| `Test-DrawioLayout.ps1` | 布局体检，查四类缺陷 | 无（只读） |

### 典型用法

```powershell
# 生成 + 立刻体检
.\scripts\New-Drawio.ps1 -Spec .\架构.json -Out .\架构.drawio -ThenTest

# 只体检
.\scripts\Test-DrawioLayout.ps1 -Path .\架构.drawio

# 逐页导出（自动数页数、自动按 1-based 循环）
.\scripts\Export-Drawio.ps1 -Path .\架构.drawio -OutDir .\out -Format png -Scale 2

# 看有几页、用的是哪个 drawio.exe
.\scripts\Export-Drawio.ps1 -Path .\架构.drawio -ListPages
```

规格格式见 [`examples/sample-architecture.json`](examples/sample-architecture.json)——
一个 4 层 15 模块的例子，跑一遍就知道怎么写了。

## 实测效果

拿一份真实的、已经用过的两页架构图跑体检：

```
  页  Id/名称                     形状  容器  连线  问题
  --  --------------------------  ----  ----  ----  ----
  1   系统架构图                       17    5     16    3
  2   产品界面效果图                     39    0     0     0

  [连线穿框] 3 处
    · 边 'e12'（用户服务 → MySQL）穿过 Kafka, Redis
    · 边 'e14'（订单服务 → MySQL）穿过 Kafka
    · 边 'e15'（支付服务 → OSS）穿过 Kafka, Redis
```

三条边从业务服务层直接连到数据层，**正交路由从中间件层的 Kafka / Redis 方框上压了过去**。
这个缺陷在渲染图上也确实存在，但光看 `.drawio` 的 XML 是看不出来的。

另一页 39 个形状**零误报**——说明豁免规则（纯标签不参与重叠检查、完全包含算有意的叠放、
连线穿过虚线层容器算正常）是有效的。

`New-Drawio.ps1` 的自动布局则实测**产出 0 问题**的图：4 层、15 个模块、12 条边。

## 安全模型

- `Test-DrawioLayout.ps1` **完全不写文件**，纯只读
- `Export-Drawio.ps1` 只在 `-OutDir`（默认 `<源文件目录>\export`）里写产物，不碰源文件
- `New-Drawio.ps1` 覆盖已有文件**需要显式 `-Force`**，避免手一抖把改好的图覆盖掉
- draw.io CLI 本身以 `--export` 方式调用，不会修改源 `.drawio`

## 局限（说清楚，别指望它做它做不到的事）

1. **文字溢出是估算。** 真实宽度取决于字体、字重、字距，且 draw.io 会自动换行。
   公式按「CJK = 1.0×fontSize、ASCII = 0.55×fontSize」估，报的是**可能**溢出。
   超 5% 以内基本可以放过。
2. **连线穿框：有拐点就按真实路径判，没有才近似。** 边带 `<Array as="points">` 时，
   体检用真实折线（出口锚点 → 拐点 → 入口锚点）；只有**没有**拐点的边才退回到
   「下出 → 中间横移 → 上进」的近似路由。所以改完走线体检结果会跟着变，
   「改 → 复验」是成立的。它报的穿框是**真的穿过了某个模块**；
   至于线段之间互相穿过，脚本不查，也不该当成问题。
3. **自动布局是「层内等分」，不是全局网格。** 每层各自把宽度等分，所以
   层与层之间的方框**列宽不一致、列不对齐**。看起来整齐，但不是表格那种对齐。
   要严格对齐得手工给坐标。
4. **不生成流程图以外的复杂图形。** 表格、泳道、时序图的自动布局没做，
   但可以用手写 XML 走体检 + 导出这条路。

## 安装

本仓库是公开 git 仓库，可以直接当包源用，不需要 npm 账号。

```powershell
# 方式一：装整个合集（推荐）
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills

# 方式二：只挂这一个技能（Junction，不需要管理员）
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\drawio" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\drawio"
```

技能根目录被 DSH 监视，**新增/改名/删除都无需重启**。

### 前置条件

- **生成和体检**：Windows PowerShell 5.1（系统自带），无需其它依赖
- **导出**：需要 draw.io 桌面版。装法：`winget install JGraph.Draw`，
  或从 <https://github.com/jgraph/drawio-desktop/releases> 下载

脚本会自动探测 draw.io 的位置。注意探测**不能依赖注册表 `InstallLocation`**——
实测它可能是空的；可靠的是 `DisplayIcon`，且末尾的 `,\d+` 是图标索引要剥掉。
探测顺序：App Paths → PATH → `InstallLocation` → `DisplayIcon` → 常见安装路径。

## 参考文档

| 文件 | 什么时候读 |
|---|---|
| [`references/01-文件格式.md`](references/01-文件格式.md) | 要手写或读懂 mxGraphModel XML、改样式、处理多页与压缩格式 |
| [`references/02-CLI导出.md`](references/02-CLI导出.md) | 改导出参数、导 PDF/SVG、遇到导出异常 |
| [`references/03-布局体检.md`](references/03-布局体检.md) | 体检报了问题要修，或想理解四类缺陷的成因与修法 |
| [`references/04-脚本维护与踩坑.md`](references/04-脚本维护与踩坑.md) | 要改这几个脚本（PowerShell 5.1 的坑都在这里） |

## 许可

[MIT](../../LICENSE) © Aurirlk · 原创技能（非二开）
