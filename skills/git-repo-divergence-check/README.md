# git-repo-divergence-check

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

判断两个仓库是不是同一条基线，然后决定：能 merge、能 cherry-pick、还是只能按路径重放。全程不下载文件内容，只比 commit 和 blob SHA。

## 什么时候用

- 「换仓库了，新地址是 X」——先确认是不是同一个代码基线
- 手上的补丁要迁到另一个仓，想知道能不能直接 `apply`
- 本机两个同名目录，不确定哪个是主线
- 想确认某个功能目录在目标仓到底存不存在

## 三步出结论

1. **无 blob 克隆**：`git clone --filter=blob:none --no-checkout`，只拉 commit + tree，大仓也秒级
2. **判同源**：拿 A 的提交 SHA 去 B 里 `cat-file -e`。存在才能 merge/rebase；不存在就只能按路径重放
3. **量化漂移**：`git ls-tree -r` 拿到每个文件的 blob SHA，用 Python 做集合运算——同路径相同/有差异、仅 A 有、仅 B 有

关键判据：**同路径差异比例高（>50%）就别打老补丁**，上下文一定对不上。

## 纯新增可以零冲突搬迁

对目标仓不存在的路径，用 git 空树做基线生成 `new file` 补丁，`apply --stat` 预览后再落。目标路径本来不存在，就没有上下文冲突这回事。

详细命令、解读表、六个踩过的坑见 [SKILL.md](SKILL.md)。

## ⚠️ 一个容易犯的错

两个同名目录，**别按文件数猜哪个是主线**。先跑第 2 步判同源，再决定谁备份谁迁走。目录名相同不等于同一基线；文件数少的那个也未必是旧分叉。

## 用法

```
我们换成新仓库了，地址是 <url>，先判断跟我这个分支是不是同一条线
```

```
这两个同名目录哪个是主线？别覆盖，先查
```

## 安装

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

只装这一个见 [仓库首页](../../README.md#只想装其中一个)。

## 边界

- 判的是内容漂移与提交血缘，不判断代码语义是否兼容
- 空树补丁只覆盖纯新增路径；有交集的改动仍需手工对齐
- 不处理鉴权配置
