# 来源与署名 / Attributions

本仓库的多数技能是**二开（fork & adapt）**的成果：以他人或官方发布的 skill 为素材，
按 DSH 的技能规范改造，并在本仓库维护。本文件记录每个来源、许可证和**我们改了什么**。

> **合规说明**
> - **Apache-2.0** 要求：保留版权与许可声明、显著标明改动、附许可证副本。见下方各条目。
> - **MIT** 要求：保留版权声明与许可声明。见下方各条目。
> - 本仓库对这些技能的改动，一律限于**适配层**（frontmatter 规范化、目录重命名、补写 README），
>   除非该条目明确写了"正文亦有改动"。

---

## vueTify0

| | |
|---|---|
| 技能 | `skills/vuetify0/` |
| 来源 | [`vuetifyjs/0`](https://github.com/vuetifyjs/0) → `skills/vuetify0/` |
| 版权 | Copyright © 2016-now Vuetify, LLC |
| 许可 | **MIT License** |
| 获取方式 | 稀疏克隆 `skills/vuetify0` 与 `LICENSE.md` |

**我们的改动**：仅 frontmatter 适配 DSH（`description` 改双语、新增 `whenToUse`）+ 补写 README。
`SKILL.md` 正文与 `references/` 保持官方原样。

---

## create-interviewer

| | |
|---|---|
| 技能 | `skills/create-interviewer/` |
| 来源 | [`Bughouse1024/interviewer-skill`](https://github.com/Bughouse1024/interviewer-skill) |
| 作者 | Bughouse1024 |
| 许可 | **MIT License** |

**我们的改动**：
- frontmatter 适配 DSH：`description` 改双语、新增 `whenToUse`
- 移除 Claude / Codex 专有字段：`allowed-tools`、`argument-hint`、`version`
- 目录名保持 `create-interviewer`（与 frontmatter `name` 对齐）
- 补写 `README.md` / `README.en.md`
- `SKILL.md` 正文、`prompts/`、`tools/` 保持原样

---

## interview-skills

| | |
|---|---|
| 技能 | `skills/interview-skills/` |
| 来源 | [`jennifer88huang/interview-skills`](https://github.com/jennifer88huang/interview-skills) |
| 作者 | jennifer88huang |
| 许可 | **MIT（作者声明，但仓库缺少 LICENSE 文件）** |

> ⚠️ **许可状态说明**：该仓库**没有 `LICENSE` 文件**，但 README 徽章与 FAQ 明确声明
> "Interview Skills is **fully open-source under the MIT license** and free to use"。
> 我们据此认定作者以 MIT 授权，并保留署名。若作者后续补充 LICENSE 文件或提出异议，本仓库会相应调整。

**我们的改动**：
- frontmatter 适配 DSH：`description` 改双语、新增 `whenToUse`
- 移除 OpenClaw / Claude 专有字段：`metadata.openclaw`、`allowed-tools`
- 补写 `README.md` / `README.en.md`
- `SKILL.md` 正文与 `references/` 保持原样

---

## code-review-refactor / git-commit-message-generator / ui-tip / ui-use-confirm

这四个技能同源，来自同一个 PR。

| | |
|---|---|
| 技能 | `skills/code-review-refactor/`、`skills/git-commit-message-generator/`、`skills/ui-tip/`、`skills/ui-use-confirm/` |
| 来源 | [`spring-ai-alibaba/DataAgent`](https://github.com/spring-ai-alibaba/DataAgent) → `data-agent-frontend-nuxt/.cursor/skills/` |
| 引入提交 | PR [#485](https://github.com/spring-ai-alibaba/DataAgent/pull/485)（2026-07-04），作者 **SmileSnow819** |
| 版权 | Copyright the Spring AI Alibaba DataAgent authors |
| 许可 | **Apache License 2.0** |

原始目录结构为 4 个目录 / 5 个技能文件（`ui-feedback-utils/` 下嵌套了 `tip/` 与 `use-confirm/`，
DSH 的技能发现只扫一层，因此必须拆开）。

**我们的改动**：

| 技能 | 改动 |
|---|---|
| `code-review-refactor` | frontmatter 适配 DSH + 补写 README；**正文未改** |
| `git-commit-message-generator` | 同上；**正文未改** |
| `ui-tip` | 目录名 `tip` → `ui-tip`；**正文有改动**——原文假定项目内已有 `$tip`，我们补上了最小实现（Nuxt plugin），使其独立可用 |
| `ui-use-confirm` | 目录名 `use-confirm` → `ui-use-confirm`；**正文有改动**——同上，补上最小实现（composable） |

`DataAgent` 采用 Apache License 2.0，完整许可证文本见
<https://github.com/spring-ai-alibaba/DataAgent/blob/main/LICENSE>。

---

## disk-butler

本仓库的原创技能，MIT License，作者 [Aurirlk](https://github.com/Aurirlk)。无第三方来源。

---

## 0.7.0 新增的 8 个原创技能

以下技能**无第三方来源**，全部由 Aurirlk 从自己的项目复盘记录中提炼，按本仓库规范撰写，
采用 MIT License：

| 技能 | 一句话来源 |
|---|---|
| `live-jvm-compile-check` | 服务不能停、又想确认改动能编译时的反复实践 |
| `db-change-report` | 多次「脚本谁执行、先跑还是先部署」的沟通事故 |
| `db-pool-forensics` | 一次 RAG 解析把连接池借空的生产事故复盘 |
| `deploy-access-chain` | 一次「覆盖成功但线上没变」的长链排查，含三条被撤回的推断 |
| `agent-chat-endpoint` | 流式对话的换行丢失 / 转圈不收尾 / 历史不落库三连症 |
| `agent-tool-safety` | 让 agent 改提示词与配置时的越权、误改、假完成事故 |
| `git-submit-safety` | 并行 agent 共用一个 worktree 时的串批与假同步 |
| `no-stub-delivery` | 「为了让演示好看而塞 mock」被当场指出之后立的规矩 |

这些技能里出现的代码片段与命令，均为**脱敏后的通用形态**：不含任何真实主机名、
凭据、库名或业务标识。

---

## 0.8.0 新增与改写的技能

以下技能**无第三方来源**，全部由 Aurirlk 从自己项目内的 `.agents/skills/` 清洗而来，
采用 MIT License：

| 技能 | 来源与清洗方式 |
|---|---|
| `docs-code-sync` | 由项目内 `docs-maintenance` 提炼。原文围绕某个仓库的具体文档树（`docs/api/**`、`docs/architecture/**`）与品牌名，已改写为通用的「改动 → 文档」映射纪律，剥离全部项目路径 |
| `vue3-admin-frontend` | 由项目内 `frontend-dev` 改写。保留技术栈与骨架约定（SoybeanAdmin 一系的 `@sa/axios`、`@elegant-router`、`useTable`），移除项目名、项目专属目录树与 `.env` 变量名 |
| `env-config` | 由项目内同名技能重写。原文已是通用形态，本次补齐判定细节（占位符 / 相对路径 / CI 读序）与验证命令 |
| `git-submit-safety`（改写） | 并入项目内 `git-submit` 的独有内容（编译前清单、ff-only 分叉、两类钩子、提交信息前缀），移除仓路径、内网远端地址、业务分支口径与具体版本号 |

清洗的硬标准：**不含任何真实主机名、内网地址、凭据、库名、包名或业务标识**。
不符合这条的技能不收录 —— 例如项目专属的开发规范手册（5400+ 行编码风格与包结构），
整篇绑定单一仓库，脱敏后即失去价值，因此留在项目仓自己的 `.agents/` 中。

---

## 0.9.0 新增的技能

| 技能 | 来源 |
|---|---|
| `frontend-delivery-method` | **无第三方来源**。由 Aurirlk 从自己多个 Vue 3 项目的工作日志与排障记录中提炼：环境连不通、依赖 `exports` 断裂、布局高度链断在页面外、流式内容卡住不出、单文件涨到六千行。每条结论后面都有一次真实翻车 |

这类技能的写法与"从教程整理的笔记"不同：**先有故障，才有条目**。所以正文里会出现
"实测 6229 行""三次探针的顺序""断在页面外那一层"这种只有踩过才写得出的判断。

文中出现的代码片段与命令均为**脱敏后的通用形态**：不含真实主机名、内网地址、项目名或业务标识。
语言包数量、文件行数等数字来自实测，不含业务内容。

---

## 相关项目（非本仓库内容）

- **[ASu-skills](https://github.com/Hisn00w/ASu-skills)** — 求职技能合集（简历「酥化」、面试预测、
  秋招进度管理、开源贡献辅助等）。本仓库**不复制其内容**，仅作推荐链接。
  Aurirlk 曾为其贡献 OpenCode 插件支持（[PR #80](https://github.com/Hisn00w/ASu-skills/pull/80)）。
- **[@vuetify/v0](https://0.vuetifyjs.com/)** — 本仓库 `vuetify0` 技能的原始出处。
- **[GitNexus](https://github.com/abhigyanpatwari/GitNexus)** — 代码知识图谱工具，自带一套
  `gitnexus-*` 技能。该项目的许可是 **PolyForm Noncommercial License 1.0.0**，
  与本仓库的 MIT 许可不兼容，因此**不复制其技能内容**，仅在此留链接，需要的人请从原仓获取。

---

## 如果你是被引用的作者

我们尽量做到署名清晰、改动透明。如果这里对来源、许可证或改动的描述有误，或者你希望
移除某个技能，请开 issue 说明，我们会尽快处理。
