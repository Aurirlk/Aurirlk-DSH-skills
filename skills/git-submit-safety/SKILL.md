---
name: git-submit-safety
description: "提交与推送的安全纪律：禁 git add -A/.、每次 add 前先看 status、精确 pathspec、提交后反查真实入树文件、push 结果以 ls-remote 为真值、远端分叉只许 ff-only、并行 agent 共用一个 worktree 时如何不互相卷走改动，以及推完之后必须交付的「编译/启动前清单」。适用于「帮我提交」「整理推送」「push 完怎么确认到没到」「hook 反复失败」「拉代码后 IDEA 报找不到符号」等场景。Safe commit & push discipline: precise pathspecs, remote-truth verification, ff-only divergence handling, shared-worktree isolation, and the post-push pre-build checklist. Triggers: 提交 / 推送 / commit / push / 整理代码提交 / 推上去没生效 / pre-commit 失败 / 找不到符号。"
whenToUse: "需要把工作区改动提交并推送时；多个 agent 或多人共用一个 worktree 时；commit 成功但远端没变化、hook 反复失败、pull 之后 IDE 编译报找不到符号、怀疑文件被误删或 .git 被破坏时。"
---

# 提交与推送的安全纪律

提交本身不难，**难的是"我提交的正好是我改的那几个文件"**，以及**"用户拿到结果之后能不能直接跑起来"**。这条技能管这两件事。

`git-commit-message-generator` 管**写什么话**；本技能管**动哪些文件、怎么确认真到了远端、推完还要交代什么**。

## 一、四条铁律

### 1. 禁 `git add -A` / `git add .` / `git commit -a`

不是洁癖，是三条现实叠在一起：

| 现实 | 后果 |
|---|---|
| 多个 agent / 多人共用一个 worktree | 别人未提交的改动被整批卷进你的提交 |
| 工作区常有临时产物、构建产物、备份目录 | 一次 `-A` 全进仓，还很难干净摘掉 |
| 某些宿主环境有 safe-delete shim 接管 `unlink` | 批量删除会静默进回收站，看起来像"文件莫名消失" |

**只 add 你这一轮真正改的文件**，用精确 pathspec。

### 2. 每次 add 之前先看 `status`

```bash
git status --short --untracked-files=all
```

这一步是**给自己看归属**，不是给 git 看。看到不认识的改动就先问清楚：是并行的另一个人刚落的，还是自己早先留下的？

### 3. push 结果以 `ls-remote` 为准

本地 `[origin/dev]` 标记会骗人 —— 远端跟踪引用没 fetch 时，它可能显示"已同步"，而远端其实已经多了一个提交。

```bash
git push origin <branch>
git ls-remote origin refs/heads/<branch>     # 和本地 HEAD 比对
git rev-parse HEAD                            # 本地真值
```

三个值一致才算推成功。

### 4. 动 `.git` 之前先备份

```bash
cp -r .git <tmp>/git-backup-$(date +%Y%m%d-%H%M%S)
```

出事后的恢复顺序：`reflog` → `fetch` → `update-ref` → `reset`。**先 reflog，别急着 reset --hard。**

## 二、标准流程

```bash
# 0. 看清现场
git status --short --untracked-files=all
git diff --stat                              # 已跟踪文件的改动规模
git fetch origin <branch>
git rev-list --count HEAD..origin/<branch>   # behind
git rev-list --count origin/<branch>..HEAD   # ahead

# 1. 按逻辑单元分组（一个提交只讲一件事）
git add -- src/A.java src/B.java
git add -- src/NewFile.java                  # 未跟踪文件必须显式列出
git commit -F -

# 2. 立刻反查：这一批到底装进了什么
git show --name-only --format= HEAD
git ls-tree -r HEAD --name-only | grep 关键新增文件

# 3. 推送 + 三值比对
git push origin <branch>
git rev-parse HEAD && git ls-remote origin refs/heads/<branch>

# 4. 收尾：推完再看一眼
git status --short --untracked-files=all
```

### 为什么要第 2 步

`git add <已跟踪目录>` **不会自动带上未跟踪的新文件**。所以"我以为加了 5 个文件"，实际可能只有 4 个。
`git show --name-only` 是唯一能在 push 之前发现这件事的地方。

### 为什么要第 4 步

实测过：推送完成后工作区又冒出一个 ` M`。原因很常见——用户一边测一边调，你在提交的同时他又改了一行。

**这类改动要单独补一个提交推掉，不要当脏数据忽略，也不要混进已完成的功能批次。** 收尾时看到非空 status，先判断是新改动还是构建产物，再决定补提交还是报备。

## 三、并行 worktree 的生存规则

同一份工作区有另一个 agent 在改代码时：

1. **改文件前**先 `git status`。同一文件两边都在改，先确认谁的版本是基线。
2. **提交前**再 `git status` 一次。中间可能已经有人落了新文件。
3. **不要 `git reset --hard`** —— 它会把别人的未提交改动一起清掉。
4. 误 add 了别人的文件：`git reset -- <path>` 精确摘掉。
5. 不要 amend 别人的提交。发现前缀写错（比如版本号），**补一个新提交**，别改历史。
6. 并行方提交后未 push 时，你的 push 会把它一起带走 —— 这是正常的，但要在交付里说明。

> **关于"哪些改动算数"**：默认口径是**工作区所有改动都是有意改动**，不替用户筛。真要排除，只排明确的临时产物（编辑器缓存、`__pycache__`、文档站构建临时目录），并且**在交付里单独列出这个例外**，让用户决定要不要加 `.gitignore`。曾经把一次改名误判成"无关 WIP"排除掉，被当场纠正。

## 四、两套钩子，两套打法

别把"hook 失败"当成一个统一问题。先看钩子到底在干什么。

### 4.1 格式化类钩子：改完文件再比 diff

典型组合：`typecheck && lint && fmt && git diff --exit-code`。

失败机制：`fmt` 会**重排文件** → 紧接着的 `git diff --exit-code` 必然非空 → 提交被拒。

```bash
pnpm fmt            # 先让格式化发生
git add -- <files>  # 把格式化结果一起 add
git commit ...      # 此时工作区与索引一致，diff 为空，钩子通过
```

**但这条只在"整仓都该格式化"时成立。** 如果你的提交是细粒度拆分（一个提交只讲一件事），跑全局 `fmt` 会把**无关文件一起重排**，拆分直接毁掉 —— 那就别跑全局格式化，改用：

```bash
pnpm typecheck                        # 手动当质量门，只检查不改文件
git add -- <精确 pathspec>
SKIP_SIMPLE_GIT_HOOKS=1 git commit -F -
```

跳过之后**必须在交付里写明为什么跳**，以及手动补了哪道检查。

> 还有一个隐蔽坑：仓库里文件是 CRLF 时，某些格式化器会**整文件报错**而不是只报改动行。看到"整个文件都错"先查换行符，别去改业务代码。

### 4.2 校验类钩子：让它跑，别跳

典型是编码/BOM 门禁：只检查、不修改文件，fail-closed（扫到 0 个文件也拒绝）。

让它跑。这类钩子跳过没有意义——它不改你的文件，失败说明**你真的错了**。

常见的错法：用 PowerShell 的 `WriteAllText` + UTF8 写 Markdown，会带上 BOM，门禁直接失败。批量替换优先用编辑器/脚本的"无 BOM UTF-8"，修 BOM 用 `utf-8-sig` 重写。

## 五、远端分叉：只许 ff-only

push 被拒最常见的原因是"远端有你没有的提交"。处理顺序：

```bash
git fetch origin <branch>
git show --name-only --format= <远端新sha>     # 看它改了什么
# 与本地改动求交集，确认零重叠
```

- **behind > 0 且本地独有提交 = 0** → `git merge --ff-only origin/<branch>`。
- **有本地提交且确有冲突** → 才考虑 rebase，且必须保证工作区干净。

**为什么不默认 rebase**：rebase 会重写历史。共享分支上重写，别人的引用全失效；而且一旦 rebase 出错，恢复要靠 reflog，比快进危险得多。

### 快进的安全验证（必做）

```bash
git status --short --untracked-files=all > /tmp/before.txt
git merge --ff-only origin/<branch>
git status --short --untracked-files=all > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt && echo "工作区改动完好无损"
```

快进动的是分支指针，理论上不该碰工作区 —— 但**"理论上"不算验证**。实测过一次 66 条改动一条没丢，靠的就是这个 `diff`。加这一步只要两秒，能省掉一次"我的改动哪去了"。

## 六、提交信息：前缀与版本号

如果团队约定了 `<type>(<版本号>): <中文描述>` 这类前缀，就保持一致，别自创风格。

两个坑：

1. **版本号不要照抄构建文件里的字段**。`pom.xml` 的 `<revision>` 这类字段经常长期不更新，真实迭代号看 `git log --oneline -10` 的既有前缀。
2. 用户要求"说人话 / 用我的原话"时，**保留前缀，冒号后写大白话**，body 里附一段用户原话说明为什么改。别把整条 message 改成口语，那会破坏历史检索。

## 七、交付：必须给「编译 / 启动前清单」

**这是本技能最容易被忽略、但用户最在意的一节。**

用户拿到"已推送"之后，下一步通常是**直接点 Run**。这时候如果只报几个 SHA，他会撞上一类特别难理解的错误：

> `java: 找不到符号` —— 而那个符号明明就在隔壁文件里。

真因不是源码坏了，是**增量编译的范围被缩到了单个文件**。拉代码/快进之后，IDE 只把"时间戳变化"的文件标脏，只编它；同包的兄弟类既不在编译单元、也不在 classpath 上，于是"找不到符号"。

所以**每次改完 / 推完代码，最终回复里必须单独给一段「编译前清单」**，至少覆盖：

1. 本轮是否新增/改动了 DTO、常量、模块依赖 → 要 **Reload All Maven Projects**（或等价的依赖重载）
2. 拉过代码 → 必须 **Rebuild Project**（全量重建）；**禁止**右键单文件 Compile、禁止只 Build 单个模块
3. 用了注解处理器（Lombok / MapStruct）→ 确认 **Annotation Processing 是开着的**，否则代码"看起来对"但生成的 getter/setter 全没有
4. 本轮有 DDL → TEST 是否已执行、PROD 待执行、**DDL 必须先于新包上线**（ORM 会把新字段拼进 SQL，库没列就报 `Unknown column`）
5. 是否需要重建产物 / 重启服务；**服务运行中禁 `mvn compile` / `clean`** —— 它会重写 `target/classes`，正在跑的 JVM 立刻 `NoClassDefFoundError`
6. 本地入口地址、必要的 profile、以及起完先探活再发请求

> 这条口径来自一次真实事故：快进拉入一个提交后，某个 DTO 文件的时间戳变了（内容其实只删了一个空行），IDE 只重编这一个文件；同包的另外两个类不在编译单元里 → `找不到符号`，服务起不来。离线复现证明：单编该文件报两处错；三个同包类一起编 `exit=0`；整个包 28 个文件 `exit=0`。**源码没坏，是编译范围的问题。**

配套技能：服务正在跑、不能 `mvn compile`，却要验改动能不能编 → 见 **live-jvm-compile-check**（借运行中 JVM 的 classpath，`javac` 只编到临时目录）。

## 八、常见误判

| 现象 | 真实原因 | 处理 |
|---|---|---|
| `git add` 报 `pathspec did not match` | 该文件已被 `git rm`，或路径写错 | 用 `git status` 里的原始路径 |
| 提交后远端 `git log` 看不到 | 推的是另一个分支 / 远端跟踪引用过期 | `ls-remote` 对账 |
| 文件"自己消失了" | 宿主 safe-delete shim 接管批量删除 | 去回收站找；恢复后重新 add |
| `merge --abort` 报 not uptodate | 有冲突文件未处理 | 先 `git checkout -- <path>` 或 `reset`，别硬 abort |
| worktree `remove` 挂起 | 目录被 IDE 冻结 | `worktree prune` + `remove --force` |
| 本地显示 ahead 0 但远端有新提交 | 没 fetch | `git fetch` 后重新比对 |
| `git.exe` 在含空格路径下报错 | 引号/转义 | 先 `cd` 到仓根，用相对路径 |
| 拉代码后 IDE 报找不到符号 | 增量编译只编变更文件 | Reload Maven + Rebuild Project，见 §七 |
| 全局 `fmt` 之后 diff 一大片无关文件 | 格式化器重排了整仓 | 细粒度提交时别跑全局格式化，见 §4.1 |
| 推送后 status 又非空 | 用户边测边改 | 单独补提交推掉，别忽略 |

## 九、自检

- [ ] 没用过 `-A` / `.` / `commit -a`
- [ ] add 之前看过 `status --untracked-files=all`
- [ ] 未跟踪的新文件是显式列出的
- [ ] `git show --name-only HEAD` 的内容与预期完全一致
- [ ] 关键新增文件用 `ls-tree` 反查过
- [ ] 有分叉时走的是 `--ff-only`，且快进前后 status diff 一致
- [ ] push 后 `ls-remote` 与本地 HEAD 一致
- [ ] 交付里写明了"已到远端，未部署"
- [ ] 交付里**单独给了「编译/启动前清单」**（不是顺带一句）
- [ ] 跳过的钩子、未提交的残留文件，都列出来并说明原因
