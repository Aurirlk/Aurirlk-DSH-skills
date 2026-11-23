---
name: git-repo-divergence-check
description: "快速判断两个 git 仓库/分支的分叉程度：能否 merge/rebase/直接 apply 补丁、哪些路径是纯新增、哪些接线点必须手工改。核心手法是无 blob 克隆 + blob SHA 比对，不下载文件内容，几十秒出结论。适用于换仓库、新主干兼容性评估、补丁搬迁、同名目录 HEAD 不一致的排查。Evaluate two repos' divergence without downloading file contents."
whenToUse: "被告知换仓库了要先判断是否同一基线；自己的分支/补丁想迁到另一个仓；判断某功能模块在目标仓是否存在；两个同名本地目录不确定哪个是最新的。"
---

# 评估两个 git 仓库的分叉程度

> 一句话判据：**先看 commit 在不在目标仓，再用 blob SHA 量化漂移。目录名相同不等于同一基线。**

同名目录、不同 HEAD，是迁移时最常见的坑。直接覆盖会丢历史，直接 `apply` 老补丁会静默错位。这套流程不下载任何文件内容，只靠 commit + tree 就能给出「能不能合、哪些能整搬、哪些要手工改」的结论。

## 何时用

- 被告知「换仓库了 / 新地址是 X」，先判断是不是同一个代码基线
- 自己的分支或补丁要迁到另一个仓，想知道能不能直接 `apply`、会不会冲突
- 判断某个功能模块在目标仓**是否存在**
- 本机有两个同名目录，不确定哪个是主线、哪个是旧分叉

## 第 1 步：无 blob 克隆（只拉 commit + tree）

```bash
git clone --quiet --filter=blob:none --no-checkout --single-branch \
  <repo-url> <temp-dir>
git -C <temp-dir> log -1 --format="%h %ad %an | %s" --date=short
git -C <temp-dir> rev-list --count HEAD
git -C <temp-dir> ls-tree --name-only HEAD          # 顶层结构
```

`--filter=blob:none` 只取提交和目录树，**不下载任何文件内容**。大仓也能秒级完成。

克隆放临时目录，别污染工作区。

## 第 2 步：判断是否同源（决定能否 merge）

```bash
git -C <other-repo> rev-parse <branch>              # 取另一个仓的目标提交
git -C <temp-dir> cat-file -e <sha>^{commit} \
  && echo "同源延续" || echo "不同源（历史被重置/另起）"
```

- **存在** → 同源，可以用 `merge` / `rebase` / `cherry-pick` / `format-patch`。
- **不存在** → 历史无关，**只能按路径重放**，不能 merge/rebase。

这一步是分水岭。跳过它直接打补丁，后面所有冲突都很难归因。

## 第 3 步：用 blob SHA 量化漂移

目录树自带每个文件的 blob SHA。比对 SHA 就知道内容是否相同，**不用下载文件**：

```bash
git -C <A> ls-tree -r <refA> > a.txt   # <mode> <type> <blob-sha>\t<path>
git -C <B> ls-tree -r <refB> > b.txt
```

用脚本做集合运算（中文路径下别用 `comm`，排序规则不一致）：

```python
def tree(repo, ref):
    out = subprocess.run(["git", "-C", repo, "ls-tree", "-r", "-z", ref],
                         capture_output=True).stdout
    d = {}
    for rec in out.split(b"\0"):
        if not rec:
            continue
        meta, path = rec.split(b"\t", 1)
        d[path.decode("utf-8", "replace")] = meta.split(b" ")[2].decode()
    return d

A, B = tree(repo_a, ref_a), tree(repo_b, ref_b)
common = set(A) & set(B)
same = [p for p in common if A[p] == B[p]]
diff = [p for p in common if A[p] != B[p]]
print(f"同路径 {len(common)}：相同 {len(same)} / 有差异 {len(diff)}")
print(f"仅 A 有 {len(set(A) - set(B))}   仅 B 有 {len(set(B) - set(A))}")
```

**怎么读结果：**

| 现象 | 结论 | 动作 |
|---|---|---|
| 同源且差异比例低 | 可以 merge / cherry-pick | 正常补丁流程 |
| 同路径差异比例高（如 >50%） | 已分叉，老补丁上下文对不上 | 按目标仓代码手工对齐 |
| 「仅 A 有」是完整功能目录 | 该功能在目标仓不存在 | 整目录搬迁 |
| 「仅 A 有」且目标仓路径完全不存在 | 纯新增，补丁零冲突 | 用空树基线生成 `new file` 补丁 |

## 生成「纯新增」的零冲突补丁

对目标仓不存在的路径，用空树做基线：

```bash
EMPTY=4b825dc642cb6eb9a060e54bf8d69288fbee4904   # git 空树 SHA
git -C <源仓> ls-tree -r --name-only <ref> | grep -E "<筛选条件>" | sort > files.txt
xargs -a files.txt git -C <源仓> diff --binary "$EMPTY" <ref> -- > port.patch
git -C <目标仓> apply --stat port.patch    # 先预览
git -C <目标仓> apply       port.patch
```

目标路径本来不存在，就没有「上下文对不上」这回事。

同名目录里挑主线时，先跑第 2 步再决定谁备份谁迁走。**别按目录名或文件数猜**——文件数少的那个未必是旧分叉，也可能是精简后的新主线。

## 坑（都踩过）

1. **`git.exe` 不认 MSYS 路径**：给 `git -C` / `git apply` 传 `/d/...`、`/tmp/...` 会报 `cannot change to ...` 或 `can't open patch`。传 Windows 形式（`D:/...`），或 `cd` 进去用相对路径。
2. **`comm` 比对必须先排序**：`git ls-tree` 对中文路径输出转义形式，和默认 `sort` 的次序不一致 → 用 Python 集合运算，或 `LC_ALL=C sort`。
3. **GitLab/Gitea 的 REST API 通常不接受 Basic auth**（新版已废弃，返回 401/404）→ 别耗时间，走 git over HTTP。
4. **`git grep` 在 blobless 克隆上可能静默返回空**（blob 未按需拉取）→ 改用 `git show <ref>:<path>` 逐文件读，或先 `git ls-tree` 按文件名缩小范围。
5. **`timeout` 在 Git Bash 下会撞 Windows 自带的 `TIMEOUT.EXE`**（报「无效语法」）→ 别包 `timeout`。

## 反模式

- ❌ 完整 `git clone` 再逐文件 diff —— 慢且没必要。
- ❌ 拿老仓的 `git diff` / `format-patch` 无脑 `apply` 到已分叉的目标仓 —— 冲突或静默错位。
- ❌ 只看目录名相同就断定「同一个仓」—— 必须比对 blob SHA 才算数。
- ❌ 两个同名目录，直接把旧的改名、新的搬进去就当迁移完成 —— 没判同源，可能把主线备份成了旧分叉。

## 边界

- 判的是**内容漂移与提交血缘**，不判断代码语义是否兼容（接口变了但文件 SHA 不同，这里查不出来）。
- 空树补丁只覆盖纯新增路径；有交集的改动仍需手工对齐。
- 凭据处理遵循 git 自身机制，本技能不负责鉴权配置。
