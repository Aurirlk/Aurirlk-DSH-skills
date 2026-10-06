# Aurirlk DSH Skills

> **我在 DeepSeek Harness 里实际用过、并验证可用的技能合集。**
>
> 每个技能一个目录，各自带 README 说明用法与安装方式。
> 不合未经测试的东西——这里只放我自己跑通过、愿意长期维护的技能。
> Deepseek-Harness：https://github.com/deepseek-ai/deepseek-harness

[![verify](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml/badge.svg)](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml)

**中文** | [English](README.en.md)

---

## 技能目录

| 技能 | 一句话说明 | 平台 | 文档 |
|---|---|---|---|
| **disk-butler** | Windows 电脑管家：查清 C/D/E 盘空间去向 → 按安全等级清理垃圾 → 用 NTFS Junction 透明迁移缓存 → 留档成本机档案 | Windows | [README](skills/disk-butler/README.md) |

<!-- 新增技能时，在上面表格里加一行，并确保 skills/<名字>/README.md 存在 -->

---

## 怎么装

### 方式一：装整个合集（推荐）

本仓库同时是一个 npm 包，装上它**一次性注册全部技能**：

```powershell
# 在 DSH 的 profile 目录里
pnpm add dsh-aurirlk-skills
```

或者用 DSH 的插件面板按包名 `dsh-aurirlk-skills` 安装。

### 方式二：只装某一个技能（技能目录直挂）

DSH 的文件系统技能发现会扫描技能根目录下的**一层**子目录（`<根>/<名字>/SKILL.md`），
所以把某个技能目录直接挂进去即可，不需要整个仓库：

```powershell
# Windows：用 Junction（不需要管理员权限）
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\disk-butler" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\disk-butler"
```

```bash
# macOS / Linux：用符号链接（技能目录被监视，新增/改名/删除无需重启 DSH）
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git ~/dev/Aurirlk-DSH-skills
ln -s ~/dev/Aurirlk-DSH-skills/skills/disk-butler ~/.dsh/skills/disk-butler
```

> 用软链/Junction 的好处：`git pull` 之后技能就是最新的，不用重新拷贝。
> DSH 的技能根目录被监视，改动会热生效。

### 方式三：其它 agent

技能本体就是 `skills/<名字>/SKILL.md`，**不依赖 DSH**。
Claude Code、Codex 等支持 `SKILL.md` 的 agent 都可以直接使用该目录：

- **Codex / OpenAI 插件**：本仓库带 `.codex-plugin/plugin.json`，可按其插件市场方式引入
- **手动**：把 `skills/<名字>/` 放到对应 agent 的技能目录

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
