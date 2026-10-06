# Aurirlk DSH Skills

> **我的 DSH 技能分享仓库。** 每个技能一个目录，各自带**中英双语 README** 说明用法与安装方式。
>
> 内容分两类：
> - **原创** —— 我自己写并在用的（如 disk-butler）
> - **二开** —— 以别人或官方发布的 skill 为素材，按 DSH 规范改造适配
>
> 二开的一律在 [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) 里写明**来源、许可证、我们改了什么**。
> Deepseek-Harness官网链接：https://github.com/deepseek-ai/deepseek-harness

> DeepSeek-Harness（dsh）是由 DeepSeek AI（深度求索） 开发的开源 Agent harness（智能体框架）。
> 它构建于一切皆插件的架构之上，由 Cordis 驱动，其设计参见论文 https://arxiv.org/abs/2608.25512。

> 文档：https://deepseek-harness.github.io/deepseek-harness/

[![verify](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml/badge.svg)](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml)

**中文** | [English](README.en.md)

---

## 技能目录

### 系统工具

| 技能 | 一句话说明 | 平台 | 文档 |
|---|---|---|---|
| **disk-butler** | Windows 电脑管家：查清 C/D/E 盘空间去向 → 按安全等级清理垃圾 → 用 NTFS Junction 透明迁移缓存 → 留档成本机档案 | Windows | [中文](skills/disk-butler/README.md) · [EN](skills/disk-butler/README.en.md) |

### 文档与图表

| 技能 | 一句话说明 | 来源 | 文档 |
|---|---|---|---|
| **drawio** | 生成 / 导出 / 体检 draw.io 图表：JSON 规格分层自动布局、逐页导出 PNG/SVG/PDF、导出前查出方框重叠与**连线穿框** | 原创 | [中文](skills/drawio/README.md) · [EN](skills/drawio/README.en.md) |

### 前端开发（Nuxt 4 / Vue 3 / Vuetify 3）

| 技能 | 一句话说明 | 来源 | 文档 |
|---|---|---|---|
| **code-review-refactor** | 可落地的代码审查与重构：重复逻辑、CSS 去重、相似页面改 JSON 驱动 | 二开 | [中文](skills/code-review-refactor/README.md) · [EN](skills/code-review-refactor/README.en.md) |
| **git-commit-message-generator** | 生成约定式提交信息，主题拒绝「修改了/更新了」这类空话 | 二开 | [中文](skills/git-commit-message-generator/README.md) · [EN](skills/git-commit-message-generator/README.en.md) |
| **ui-tip** | 统一全局 Toast 规范：成功走默认、**错误必须显式指定 icon** | 二开（正文有改动） | [中文](skills/ui-tip/README.md) · [EN](skills/ui-tip/README.en.md) |
| **ui-use-confirm** | 统一确认弹窗规范，并明确哪些操作必须先二次确认 | 二开（正文有改动） | [中文](skills/ui-use-confirm/README.md) · [EN](skills/ui-use-confirm/README.en.md) |
| **vuetify0** | `@vuetify/v0` 无样式组件与 composable 的用法与编写指南 | 官方 skill | [中文](skills/vuetify0/README.md) · [EN](skills/vuetify0/README.en.md) |

### 求职 / 面试

| 技能 | 一句话说明 | 来源 | 文档 |
|---|---|---|---|
| **create-interviewer** | 把一位面试官蒸馏成会持续进化的 AI 角色（技术图谱 + 行为档案 + 人格画像） | 二开（MIT） | [中文](skills/create-interviewer/README.md) · [EN](skills/create-interviewer/README.en.md) |
| **interview-skills** | 大厂 AI 模拟面试官：按公司 + 岗位 + JD + 简历出题，带好答案/差答案对比与多轮模拟 | 二开（MIT） | [中文](skills/interview-skills/README.md) · [EN](skills/interview-skills/README.en.md) |

> 二开来源与许可详见 [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)。

---

## 相关项目

以下项目**不在本仓库**（人家有自己的仓库，重复上传没有意义），只作推荐：

| 项目 | 说明 |
|---|---|
| **[ASu-skills](https://github.com/Hisn00w/ASu-skills)** | 求职技能合集（5.4k ⭐）：简历「酥化」、面试预测与追问强化、秋招进度管理、开源贡献辅助等。Aurirlk 曾为其贡献 OpenCode 插件支持（[PR #80](https://github.com/Hisn00w/ASu-skills/pull/80)） |
| **[@vuetify/v0](https://0.vuetifyjs.com/)** | 本仓库 `vuetify0` 技能的原始出处，Vue 3 的无样式逻辑层 |

<!-- 新增技能时，在上面表格里加一行，并确保 skills/<名字>/README.md 存在 -->

---

## 怎么装

> **本仓库是公开的 git 仓库，可以直接当作包源用。**
> 不需要 npm registry，也不需要 npm 账号。

### 方式一：装整个合集（推荐）

在 DSH 的 profile 目录里把本仓库装上，**一次性注册全部技能**：

```powershell
# Windows —— profile 目录不一定叫 desktop，按你实际的来
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

```bash
# macOS / Linux
cd ~/.dsh/profiles/desktop
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

装完后 DSH 会读包里的 `dsh.bundle.patch`，把 `skills/` 下的技能全部注册进去。
实测约 **7 秒**完成。

**更新到最新版：**

```powershell
pnpm update dsh-aurirlk-skills
```

### 方式二：只装某一个技能（技能目录直挂）

DSH 的文件系统技能发现会扫描技能根目录下的**一层**子目录（`<根>/<名字>/SKILL.md`），
所以把某个技能目录直接挂进去即可，不需要整个仓库、也不需要装包：

```powershell
# Windows：用 Junction（不需要管理员权限）
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\disk-butler" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\disk-butler"
```

```bash
# macOS / Linux：用符号链接
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git ~/dev/Aurirlk-DSH-skills
ln -s ~/dev/Aurirlk-DSH-skills/skills/disk-butler ~/.dsh/skills/disk-butler
```

> **两种方式的取舍**：
> - 方式一装整个合集，新增技能自动生效；适合想跟着更新的人
> - 方式二只挂一个技能，仓库里的其它技能不会进你的环境；适合只用其中一个
>
> 两者都用 Junction/软链，所以 `git pull` 之后技能就是最新的，不用重新拷贝。
> DSH 的技能根目录被监视，**新增/改名/删除都无需重启**。

### 方式三：其它 agent

技能本体就是 `skills/<名字>/SKILL.md`，**不依赖 DSH**。
Claude Code、Codex 等支持 `SKILL.md` 的 agent 都可以直接使用该目录：

- **Codex / OpenAI 插件**：本仓库带 `.codex-plugin/plugin.json`，可按其插件市场方式引入
- **手动**：把 `skills/<名字>/` 放到对应 agent 的技能目录

### 验证装好了没

```powershell
# 直接问 agent：「我电脑 C 盘满了」或「查一下我电脑」——它应当自动加载 disk-butler
# 也可以手动跑技能自检：
& "$env:USERPROFILE\.dsh\skills\disk-butler\scripts\Test-SkillHealth.ps1" -Deep
```

> **关于 npm**：本仓库的 `package.json` 是一个合法的 npm 包（`dsh-aurirlk-skills`），
> 但**尚未发布到 npm registry**，所以 `pnpm add dsh-aurirlk-skills` 现在会失败。
> 请用方式一。git 安装和 npm 安装的包内容完全一致。

---

## 仓库结构

```
Aurirlk-DSH-skills/
├── README.md                  ← 你在这里（仓库介绍 + 技能目录）
├── LICENSE / CONTRIBUTING.md / SECURITY.md / CHANGELOG.md
├── .gitattributes / .editorconfig / .gitignore / .npmignore
├── .github/workflows/verify.yml    ← CI：遍历所有技能做校验
├── scripts/Fix-Bom.ps1             ← 仓库级开发工具（不随包发布）
├── index.js / cordis.patch.yml / package.json   ← 合集包（注册所有技能）
├── .codex-plugin/plugin.json       ← Codex/OpenAI 插件清单
└── skills/
    └── disk-butler/           ← 技能一
        ├── README.md          ← 该技能的介绍 / 用法 / 安装
        ├── SKILL.md           ← 技能本体（agent 读的就是它）
        ├── scripts/           ← 可执行脚本
        └── references/        ← 按需加载的参考文档
```

### 为什么技能放在 `skills/<名字>/` 而不是仓库根目录

这不是随意选的，是两条规范交叉的结果：

- **DSH 的文件系统技能发现只扫一层**：`<根>/<名字>/SKILL.md`，不支持嵌套
- **Codex/OpenAI 插件规范要求** `plugin.json` 的 `skills` 字段指向一个**名为 `skills` 的目录**

把技能放在 `skills/` 下，两个要求同时满足，而且一份技能真源可以三种方式分发
（DSH 插件 / Codex 插件 / 通用 agent skill），不需要维护多份副本。

### 新增一个技能

1. `skills/<名字>/SKILL.md`——正文，frontmatter 必填 `name`（kebab-case，**须与目录名一致**）与 `description`
2. `skills/<名字>/README.md`——给人看的介绍、用法、安装
3. 在本文的[技能目录](#技能目录)表格里加一行
4. 跑一遍校验：

```powershell
.\scripts\Fix-Bom.ps1                                    # 编码/BOM
.\skills\<名字>\scripts\Test-SkillHealth.ps1 -Deep        # 该技能自检（若有）
node scripts\self-test.mjs                               # 合集注册逻辑
```

**`index.js` 不需要改**——它会自动遍历 `skills/` 注册所有含 `SKILL.md` 的目录。

---

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。**最重要的一条是 BOM 约定**——
本仓库的技能以 Windows PowerShell 为主，而 PS 5.1 对编码极其敏感：
`.ps1` 必须有 BOM、`SKILL.md` 必须没有 BOM，两个方向相反、极易弄反。

## 安全

本仓库的技能可能**修改或删除你机器上的文件**（例如 disk-butler 会清理磁盘）。
每个技能自己的 README 里有它的安全模型，**使用前请先读**。
漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 许可

[MIT](LICENSE) © Aurirlk
