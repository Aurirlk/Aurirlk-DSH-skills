---
name: git-submit-safety
description: "提交与推送的安全纪律：禁 git add -A/.、每次 add 前先看 status、精确 pathspec、提交后反查真实入树文件、push 结果以 ls-remote 为真值、并行 agent 共用一个 worktree 时如何不互相卷走改动。适用于「帮我提交」「整理推送」「push 完怎么确认到没到」「hook 报错怎么过」「文件莫名消失 / .git 好像坏了」等场景。Safe commit & push discipline: precise pathspecs, remote-truth verification, shared-worktree isolation. Triggers: 提交 / 推送 / commit / push / 整理代码提交 / 推上去没生效 / pre-commit 失败。"
whenToUse: "需要把工作区改动提交并推送时；多个 agent 或多人共用一个 worktree 时；commit 成功但远端没变化、hook 反复失败、怀疑文件被误删或 .git 被破坏时。"
---

# 提交与推送的安全纪律

提交本身不难，**难的是"我提交的正好是我改的那几个文件"**。这条技能管的就这一件事：让每一次提交都精确、可反查、可回滚。

`git-commit-message-generator` 管**写什么话**；本技能管**动哪些文件、怎么确认真到了远端**。两个一起用。

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
git diff --stat                    # 已跟踪文件的改动规模

# 1. 按逻辑单元分组（一个提交只讲一件事）
git add -- src/A.java src/B.java
git add -- src/NewFile.java        # 未跟踪文件必须显式列出

# 2. 提交（多行说明用 -F - 从 stdin 读）
git commit -F -

# 3. 立刻反查：这一批到底装进了什么
git show --name-only --format= HEAD
git ls-tree -r HEAD --name-only | grep 关键新增文件

# 4. 推送 + 三值比对
git push origin <branch>
git rev-parse HEAD && git ls-remote origin refs/heads/<branch>
```

### 为什么要第 3 步

`git add <已跟踪目录>` **不会自动带上未跟踪的新文件**。所以"我以为加了 5 个文件"，实际可能只有 4 个。
`git show --name-only` 是唯一能在 push 之前发现这件事的地方。

## 三、并行 worktree 的生存规则

同一份工作区有另一个 agent 在改代码时：

1. **改文件前**先 `git status`。同一文件两边都在改，先确认谁的版本是基线。
2. **提交前**再 `git status` 一次。中间可能已经有人落了新文件。
3. **不要 `git reset --hard`** —— 它会把别人的未提交改动一起清掉。
4. 误 add 了别人的文件：`git reset -- <path>` 精确摘掉。
5. 不要 amend 别人的提交。发现前缀写错（比如版本号），**补一个新提交**，别改历史。
6. 并行方提交后未 push 时，你的 push 会把它一起带走 —— 这是正常的，但要在交付里说明。

## 四、hook 反复失败

前端仓的 pre-commit 常见组合是：`typecheck && lint && fmt && git diff --exit-code`。

**fmt 会重排文件 → `git diff --exit-code` 必然失败** —— 这时的正确姿势不是绕过检查，而是让检查过后工作区是干净的：

```bash
pnpm fmt          # 先格式化
git add -- <files>  # 再把格式化结果 add 进去
git commit ...      # 此时 diff 为空，hook 自然通过
```

只有确认 hook 本身与本次提交无关（例如只改了后端却触发了前端 hook），才用 `SKIP_SIMPLE_GIT_HOOKS=1` 这类开关，并在交付里写明**为什么跳过**。

## 五、常见误判

| 现象 | 真实原因 | 处理 |
|---|---|---|
| `git add` 报 `pathspec did not match` | 该文件已被 `git rm`，或路径写错 | 用 `git status` 里的原始路径 |
| 提交后远端 `git log` 看不到 | 推的是另一个分支 / 远端跟踪引用过期 | `ls-remote` 对账 |
| 文件"自己消失了" | 宿主 safe-delete shim 接管批量删除 | 去回收站找；恢复后重新 add |
| `merge --abort` 报 not uptodate | 有冲突文件未处理 | 先 `git checkout -- <path>` 或 `reset`，别硬 abort |
| worktree `remove` 挂起 | 目录被 IDE 冻结 | `worktree prune` + `remove --force` |
| 本地显示 ahead 0 但远端有新提交 | 没 fetch | `git fetch` 后重新比对 |

## 六、交付时必须说清

1. **提交了哪些文件**（数量 + 关键路径）
2. **推到哪个分支**，`ls-remote` 的实际 SHA
3. **"代码已到远端" ≠ "已部署"** —— 发版另算，别让用户以为推完就上线
4. 有跳过的 hook / 未提交的残留文件（例如构建产物），**列出来并说明为什么不提交**

第 3 条尤其重要：`git push` 与"线上生效"之间通常还隔着一次构建、一次部署、一次重启。

## 七、自检

- [ ] 没用过 `-A` / `.` / `commit -a`
- [ ] add 之前看过 `status --untracked-files=all`
- [ ] 未跟踪的新文件是显式列出的
- [ ] `git show --name-only HEAD` 的内容与预期完全一致
- [ ] 关键新增文件用 `ls-tree` 反查过
- [ ] push 后 `ls-remote` 与本地 HEAD 一致
- [ ] 交付里写明了"已到远端，未部署"
