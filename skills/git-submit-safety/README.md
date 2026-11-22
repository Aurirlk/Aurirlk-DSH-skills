# git-submit-safety

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

管住一件事：**你提交的，正好是你改的那几个文件；你说推上去了，就真的推上去了。**

写提交信息用 [git-commit-message-generator](../git-commit-message-generator/README.md)；本技能管**动哪些文件、怎么验真**。

## 什么时候用

- 「帮我提交并推送」
- push 完不确定到底到没到远端
- pre-commit 反复失败（尤其实前端仓 `fmt` + `git diff --exit-code` 那套）
- 两个 agent / 两个人共用一个 worktree，怕互相卷走改动
- 文件莫名消失、`.git` 好像被弄坏了

## 四条铁律

1. **禁 `git add -A` / `.` / `commit -a`** —— 并行改动、临时产物、构建产物会被整批卷进去
2. **每次 add 之前先 `git status --short -uall`** —— 这一步是给自己看归属
3. **push 结果以 `git ls-remote` 为准** —— 本地 `[origin/dev]` 标记会骗人
4. **动 `.git` 前先 `cp -r .git`** —— 恢复顺序 reflog → fetch → update-ref → reset

## 最容易被忽略的一步

除了禁 `-A`，还有一条更隐蔽的：

> **`git add <已跟踪目录>` 不会自动带上未跟踪的新文件。**

所以「我以为提交了 5 个文件」经常实际只有 4 个。唯一能在 push 之前发现的办法：

```bash
git show --name-only --format= HEAD
```

每次提交后立刻跑，一眼就能看出有没有漏。

## ⚠️ 风险声明

这个技能本身**不改你的代码、不删你的文件**。但它会执行 `git add` / `commit` / `push`，属于会改变仓库状态的操作。

- 推送前请确认分支正确（尤其别把测试提交推到 main）
- 涉及 force push / reset --hard 时，agent 必须先说明影响并等你确认

## 用法

```
帮我提交，别用 add -A，按逻辑拆两个提交
```

```
我刚 push 了，你确认一下远端是不是真到了
```

具体命令序列和判据表在 [SKILL.md](SKILL.md)。

## 安装

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

只装这一个见 [仓库首页](../../README.md#只想装其中一个)。

## 边界

- 只管**提交与推送**。合并、冲突解决、变基策略、PR 流程不在范围内
- 强依赖 `git` 的常规语义，对 Git LFS、submodule 等特殊结构只给通用建议
- 「提交纪律」是团队约定，不是 git 强制行为 —— 需要人和 agent 都守
