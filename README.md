# Aurirlk DSH Skills

**一个 DSH 技能包集合。装一次，你的 agent 就多会十几件事。**

[![verify](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml/badge.svg)](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml)

**中文** | [English](README.en.md)

---

## 这玩意儿是干什么的

DeepSeek Harness（简称 DSH）是个 agent 框架——你可以理解成一个能读文件、能跑命令、能调工具的 AI 助手。[官网](https://github.com/deepseek-ai/deepseek-harness) · [文档](https://deepseek-harness.github.io/deepseek-harness/)

但它默认是"什么都会一点，什么都不精"。

**技能（skill）就是给它补一门手艺。**

一个技能就是一份写好的说明书：告诉它做某类事的时候，按什么顺序来、什么不能做、什么情况该停下来问。

这个仓库里放的是我攒下来的技能，**装一次全部生效**，随时 `git pull` 就跟上更新。

> 里面有两类：**原创**（我自己写的）和**二开**（拿别人的改的）。
> 二开的都在 [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) 里写清了来源、许可证、改了什么。

---

## 你可能正需要它

| 你遇到的麻烦 | 该用哪个 |
|---|---|
| C 盘红了，不知道哪些能删、哪些删了就废 | **disk-butler** |
| 要画架构图，不想一个个手动拖框对齐 | **drawio** |
| 要给业务方写更新日志，写着写着全是黑话 | **speak-human** |
| 线上出问题，查了两小时发现方向一开始就错了 | **systematic-rca** |
| 用大白话问数据库，怕查出别人家的数据 | **nl2sql-analyst** |
| 一个助手要管一堆能力，不知道什么话该谁答 | **agent-orchestration** |
| 看监控画面判状态，容易看花眼 | **visual-scene-judge** |
| 要判断 agent 到底有没有按要求干活 | **agent-trace-eval** |
| 面试前想按真实 JD 练几轮 | **interview-skills** |
| 代码重复太多，想清理但不敢动 | **code-review-refactor** |
| 服务还开着，想确认刚改的 Java 能不能编过 | **live-jvm-compile-check** |
| 提交完不确定到底推没推上去 | **git-submit-safety** |
| 改了库，得让运维去执行脚本 | **db-change-report** |
| 接口随机 500，报连接池耗尽 | **db-pool-forensics** |
| 覆盖了文件，线上还是旧包 | **deploy-access-chain** |
| 流式对话：表格不渲染 / 答完还转圈 / 没历史 | **agent-chat-endpoint** |
| 要给 AI 加一个能改数据的工具，怕它乱来 | **agent-tool-safety** |
| 交付前怀疑有假数据、假实现 | **no-stub-delivery** |

---

## 技能目录

共 **23 个**。

### 系统工具

| 技能 | 什么时候用 | 平台 | 文档 |
|---|---|---|---|
| **disk-butler** | C 盘满了：先告诉你空间去哪了，再按危险程度清理，最后把写死在 C 盘的缓存搬到别的盘，并留一份本机档案 | Windows | [中文](skills/disk-butler/README.md) · [EN](skills/disk-butler/README.en.md) |

### 文档与图表

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **drawio** | 要画架构图：写几行 JSON 就出图，能批量导 PNG/SVG/PDF，导出前先告诉你哪几个框叠一起了 | 原创 | [中文](skills/drawio/README.md) · [EN](skills/drawio/README.en.md) |
| **speak-human** | 要把技术改动讲给业务方听：三步改写成大白话，顺手清掉「赋能」「打通」这类词 | 原创 | [中文](skills/speak-human/README.md) · [EN](skills/speak-human/README.en.md) |

### 前端开发（Nuxt 4 / Vue 3 / Vuetify 3）

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **code-review-refactor** | 代码重复太多：找出重复的、合并掉，相似页面改成配置驱动 | 二开 | [中文](skills/code-review-refactor/README.md) · [EN](skills/code-review-refactor/README.en.md) |
| **git-commit-message-generator** | 写 commit：按 feat/fix/docs 分类，主题不许写「修改了」「更新了」 | 二开 | [中文](skills/git-commit-message-generator/README.md) · [EN](skills/git-commit-message-generator/README.en.md) |
| **ui-tip** | 全局提示不统一：定死成功走默认样式，报错必须显式指定图标 | 二开（正文有改动） | [中文](skills/ui-tip/README.md) · [EN](skills/ui-tip/README.en.md) |
| **ui-use-confirm** | 哪些操作该弹二次确认：定好规矩，别每次临时拍脑袋 | 二开（正文有改动） | [中文](skills/ui-use-confirm/README.md) · [EN](skills/ui-use-confirm/README.en.md) |
| **vuetify0** | 用 `@vuetify/v0` 写组件：无样式组件和 composable 怎么用 | 官方 skill | [中文](skills/vuetify0/README.md) · [EN](skills/vuetify0/README.en.md) |

### 后端与运维

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **live-jvm-compile-check** | 服务还开着，想确认刚改的 Java 能不能编过：从运行中的 JVM 借 classpath，只编到临时目录 | 原创 | [中文](skills/live-jvm-compile-check/README.md) · [EN](skills/live-jvm-compile-check/README.en.md) |
| **db-change-report** | 改了库要交给别人执行：五项必答（脚本 / TEST / PROD 顺序 / 是否重启 / 回滚），附幂等写法与历史表方案 | 原创 | [中文](skills/db-change-report/README.md) · [EN](skills/db-change-report/README.en.md) |
| **db-pool-forensics** | 连接池耗尽：先分清「借空」还是「DB 拒绝」，再找谁在占连接，最后把限流挂在唯一汇入口 | 原创 | [中文](skills/db-pool-forensics/README.md) · [EN](skills/db-pool-forensics/README.en.md) |
| **deploy-access-chain** | 覆盖了文件线上还是旧包：用访问日志关联证明请求落在哪台机器哪个目录，再谈发版 | 原创 | [中文](skills/deploy-access-chain/README.md) · [EN](skills/deploy-access-chain/README.en.md) |

### 交付与协作

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **git-submit-safety** | 提交与推送的安全纪律：禁 `add -A`、精确 pathspec、push 结果以 `ls-remote` 为真值 | 原创 | [中文](skills/git-submit-safety/README.md) · [EN](skills/git-submit-safety/README.en.md) |
| **no-stub-delivery** | 交付前查真假：认得出假数据、假实现（写了没接线）、假完成（文档说做了但代码没有） | 原创 | [中文](skills/no-stub-delivery/README.md) · [EN](skills/no-stub-delivery/README.en.md) |

### 求职 / 面试

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **create-interviewer** | 想反复练同一位面试官：把ta的思路、偏好、提问习惯固化成 AI 角色 | 二开（MIT） | [中文](skills/create-interviewer/README.md) · [EN](skills/create-interviewer/README.en.md) |
| **interview-skills** | 模拟大厂面试：给公司、岗位、JD 和简历，它出题并对比「好答案 / 差答案」 | 二开（MIT） | [中文](skills/interview-skills/README.md) · [EN](skills/interview-skills/README.en.md) |

### AI 评测

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **agent-trace-eval** | 判断 agent 有没有按要求干活：拿它的调用记录一步步核对，标出哪步错了、多严重、怎么改 | 原创 | [中文](skills/agent-trace-eval/README.md) · [EN](skills/agent-trace-eval/README.en.md) |

### 推理与诊断

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **systematic-rca** | 出问题查原因：先看清现象，再列可能，想办法排除，最后才动手。防的是「第一眼就下结论」 | 原创 | [中文](skills/systematic-rca/README.md) · [EN](skills/systematic-rca/README.en.md) |
| **visual-scene-judge** | 看监控画面判状态：先说清能看清什么，再用四个维度交叉判断，冲突时如实报冲突 | 原创 | [中文](skills/visual-scene-judge/README.md) · [EN](skills/visual-scene-judge/README.en.md) |

### AI 应用编排

| 技能 | 什么时候用 | 来源 | 文档 |
|---|---|---|---|
| **agent-orchestration** | 一个助手管一堆能力：什么话该谁答、上下文怎么记、大屏和对话框怎么说不同的话 | 原创 | [中文](skills/agent-orchestration/README.md) · [EN](skills/agent-orchestration/README.en.md) |
| **nl2sql-analyst** | 用大白话查数据库：说人话出 SQL，多租户不会串，查不到就直说没数据 | 原创 | [中文](skills/nl2sql-analyst/README.md) · [EN](skills/nl2sql-analyst/README.en.md) |
| **agent-chat-endpoint** | 流式对话四件套：空白增量别丢、慢动作不挂流尾、登录态在请求线程取、压缩边界用消息 id | 原创 | [中文](skills/agent-chat-endpoint/README.md) · [EN](skills/agent-chat-endpoint/README.en.md) |
| **agent-tool-safety** | 给 agent 加会改数据的工具：`draft_*` 命名、双层确认、带 scope、开关做在装配层、沙箱只读 | 原创 | [中文](skills/agent-tool-safety/README.md) · [EN](skills/agent-tool-safety/README.en.md) |

### 别人的项目（不在本仓库）

| 项目 | 说明 |
|---|---|
| **[ASu-skills](https://github.com/Hisn00w/ASu-skills)** | 求职技能合集（5.4k ⭐）：简历「酥化」、面试预测与追问强化、秋招进度管理。Aurirlk 给它贡献过 OpenCode 插件支持（[PR #80](https://github.com/Hisn00w/ASu-skills/pull/80)） |
| **[@vuetify/v0](https://0.vuetifyjs.com/)** | 本仓库 `vuetify0` 技能的原始出处，Vue 3 的无样式逻辑层 |

<!-- 新增技能时，在上面表格里加一行，并确保 skills/<名字>/README.md 存在 -->

---

## 怎么装

前提：你已经装好了 DSH，并且有一个 profile 目录（一般长这样 `~/.dsh/profiles/desktop`，具体名字按你的来）。

### 一次装全部（推荐）

```powershell
# Windows
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

```bash
# macOS / Linux
cd ~/.dsh/profiles/desktop
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

**装完不用重启。** DSH 会自己扫到 `skills/` 下的所有技能，实测约 7 秒。

以后想更新：

```powershell
pnpm update dsh-aurirlk-skills
```

> ⚠️ **别用 `pnpm add dsh-aurirlk-skills`**（不带 `github:` 那种）。这个包还没发到 npm 官方仓库，那条命令会失败。
> 用上面那条 git 地址就行，两者内容完全一样。

### 只想装其中一个

技能目录是直接挂进去用的，不需要装整包：

```powershell
# Windows：用 Junction 挂进去（不需要管理员权限）
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\disk-butler" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\disk-butler"
```

```bash
# macOS / Linux：用软链接
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git ~/dev/Aurirlk-DSH-skills
ln -s ~/dev/Aurirlk-DSH-skills/skills/disk-butler ~/.dsh/skills/disk-butler
```

两种方式怎么选：

| | 装全部 | 只装一个 |
|---|---|---|
| 适合谁 | 想跟着更新的人 | 只用其中一两个的人 |
| 以后新增的技能 | 自动生效 | 不会进来 |
| 更新 | `pnpm update` | `git pull` 即可，因为挂的是链接 |

**两种都是链接，不是拷贝。** 所以 `git pull` 之后技能就是最新的，不用重新搬。
技能目录被监视着，**新增、改名、删除都不用重启**。

### 给别的 agent 用

技能本体就是 `skills/<名字>/SKILL.md`，**不依赖 DSH**。

Claude Code、Codex 这些认 `SKILL.md` 的 agent 都能直接用：

- **Codex / OpenAI 插件**：仓库带了 `.codex-plugin/plugin.json`，按它的插件方式引入
- **手动**：把 `skills/<名字>/` 整个目录，拷到那个 agent 的技能目录里

### 怎么确认装好了

直接跟 agent 说一句「我 C 盘满了」或「查一下我电脑」，它应该自己加载 **disk-butler**。

也可以手动跑技能自检：

```powershell
& "$env:USERPROFILE\.dsh\skills\disk-butler\scripts\Test-SkillHealth.ps1" -Deep
```

---

## 常见问题

**装了没反应？**
先确认文件夹名字对得上：DSH 只认 `SKILL.md` 里的 `name` 和目录名一致的情况。改完不用重启，但 DSH 确实要能扫到那个目录。

**会不会乱删我的文件？**
会动手的技能（比如 disk-butler）在自己的 README 里都写了安全模型——**删之前会先给你看清单，按危险程度分级**。用之前读一下那篇，别闭眼跑。

**能只装其中几个吗？**
能，见上面「只想装其中一个」。挂几个都行，互不影响。

**这和 npm 包有什么区别？**
`package.json` 是合法的 npm 包，但没发布。走 git 装，内容和 npm 装的一模一样。

---

## 仓库长什么样

```
Aurirlk-DSH-skills/
├── README.md                  ← 你在这里
├── LICENSE / CONTRIBUTING.md / SECURITY.md / CHANGELOG.md
├── .github/workflows/verify.yml    ← CI：遍历所有技能做校验
├── index.js / cordis.patch.yml / package.json   ← 合集包（负责注册全部技能）
├── .codex-plugin/plugin.json       ← Codex / OpenAI 插件清单
├── scripts/                        ← 仓库级开发工具（不随包发布）
└── skills/
    └── disk-butler/           ← 一个技能
        ├── README.md          ← 给人看的：介绍 / 用法 / 安装
        ├── SKILL.md           ← 技能本体（agent 读的就是它）
        ├── scripts/           ← 可执行脚本
        └── references/        ← 按需加载的参考文档
```

---

## 想自己加一个技能

三步：

1. `skills/<名字>/SKILL.md` —— 技能本体。开头必须有一段元信息，至少写 `name`（小写连字符，**必须和目录名一样**）和 `description`
2. `skills/<名字>/README.md` —— 给人看的介绍、用法、安装
3. 在上面[技能目录](#技能目录)里加一行，然后跑一遍校验：

```powershell
.\scripts\Fix-Bom.ps1                              # 检查编码和 BOM
.\skills\<名字>\scripts\Test-SkillHealth.ps1 -Deep  # 该技能自检（如果有）
node scripts\self-test.mjs                          # 合集注册逻辑
```

**`index.js` 不用改。** 它会自己遍历 `skills/`，凡是带 `SKILL.md` 的目录都注册。

### 为什么技能必须放在 `skills/<名字>/` 下

不是随便定的，是两条规矩撞在一起的结果：

- DSH 找技能时**只扫一层**：`<根>/<名字>/SKILL.md`，不支持再往下嵌套
- Codex / OpenAI 的插件规范要求 `plugin.json` 里 `skills` 指向一个**叫 `skills` 的目录**

放成 `skills/<名字>/`，两边的规矩同时满足，而且同一份技能能直接用三种方式发（DSH 插件 / Codex 插件 / 通用 agent skill），不用维护多份副本。

---

## 参与贡献

看 [CONTRIBUTING.md](CONTRIBUTING.md)。

**最要紧的一条是 BOM。** 这仓库里的脚本以 Windows PowerShell 为主，而 PS 5.1 对编码特别挑：

- `.ps1` 文件**必须带** BOM
- `SKILL.md` **必须不带** BOM

两个方向正好相反，非常容易弄反，弄反了不会报错，只会静默出问题。

## 安全

这个仓库里的技能**可能会修改或删除你机器上的文件**（比如 disk-butler 就是干这个的）。

每个技能自己的 README 里都写了它的安全模型，**用之前读一下**。发现漏洞请按 [SECURITY.md](SECURITY.md) 的方式报。

## 许可

[MIT](LICENSE) © Aurirlk
