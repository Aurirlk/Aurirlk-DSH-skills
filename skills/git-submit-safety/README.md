# git-submit-safety

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

管住三件事：**你提交的，正好是你改的那几个文件；你说推上去了，就真的推上去了；用户拿到结果后能直接跑起来。**

写提交信息用 [git-commit-message-generator](../git-commit-message-generator/README.md)；本技能管**动哪些文件、怎么验真、推完还要交代什么**。

## 什么时候用

- 「帮我提交并推送」
- push 完不确定到底到没到远端
- pre-commit 反复失败（尤其是 `fmt` + `git diff --exit-code` 那套）
- 两个 agent / 两个人共用一个 worktree，怕互相卷走改动
- 文件莫名消失、`.git` 好像被弄坏了
- **拉完代码点 Run，IDE 报 `找不到符号`**

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

## 推完不是结束：要给「编译/启动前清单」

这是这个技能里最容易被跳过的部分，也是用户最在意的部分。

推完代码，用户下一步通常是**直接点 Run**。这时候如果只报几个 SHA，他会撞上一类特别难理解的错误：

```
java: 找不到符号
```

而那个符号明明就在隔壁文件里。

**真因不是源码坏了，是增量编译的范围被缩到了单个文件。** 拉代码/快进之后，IDE 只把时间戳变化的文件标脏、只编它；同包兄弟类既不在编译单元、也不在 classpath 上，于是"找不到符号"。

所以每次交付都要单独给一段清单，至少覆盖：

1. 是否新增/改了 DTO、常量、模块依赖 → **Reload All Maven Projects**
2. 拉过代码 → **Rebuild Project**；禁止右键单文件 Compile
3. 注解处理器（Lombok / MapStruct）是否开着
4. 本轮有 DDL → TEST 执行了没、PROD 待执行、**DDL 必须先于新包**
5. 要不要重建产物 / 重启；**服务运行中禁 `mvn compile`**
6. 本地入口、profile，起完先探活

> 真实事故：快进拉入一个提交，某个 DTO 文件时间戳变了（内容只删了一个空行），IDE 只重编它 → 同包两个类不在编译单元 → 服务起不来。离线复现证明源码没问题，是编译范围的问题。

## 远端有分叉：只许 ff-only

push 被拒时，`merge --ff-only` 优先，**不默认 rebase**（rebase 重写共享历史，出错只能靠 reflog 捞）。

快进前后各存一份 `status --untracked-files=all` 并 `diff`，输出"改动完好无损"才继续。这一步实测救过一次 66 条改动。

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
