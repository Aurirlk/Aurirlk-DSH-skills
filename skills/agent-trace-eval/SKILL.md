---
name: agent-trace-eval
description: "Agent Trace 评测：按三种场景评估 Agent 是否真的遵循了用户指令——错误判断（指令遵循错误定位与分级）、工具调用（逐个 Function Call 判定）、白盒测试（Rubric 设计 + Ground Truth 计算）。采用业界通用术语：Instruction Understanding / Scope / Filtering / Tool-use / Parameter / Workflow / Side Effect / Output Format；Correct / Incorrect / Unnecessary / Cannot Determine。Evaluate agent traces in three modes: error location, per-call labeling, and white-box rubric design. Triggers: Agent 评测 / Trace 评测 / 工具调用评测 / 指令遵循 / Function Call 标注 / Rubric 设计 / 防幻觉评测。"
whenToUse: "用户给出 Tool Schema、用户指令和一条 Agent Trace，要求判断哪里违了指令（错误判断）、逐步标注每个 Function Call（工具调用）、或设计评测 Rubric 并计算 Ground Truth（白盒测试）时。也用于审核他人标注、给 Agent 上线做回归门禁。"
---

# Agent Trace 评测

> 一句话：**把用户的每句自然语言翻译成可勾选的检查项，只把有检查项支撑的行为记为错误。**

## 0. 三种场景，先选对再动手

同一个 Agent Trace，三种问法要用三套输出，**混用就是答错**。

| 场景 | 典型问法 | 输出 | 详细 |
|---|---|---|---|
| **A · 错误判断** | 「找出 Trace 里所有明确的错误」 | 一张错误清单，每条含 6 个字段 | [`references/01-错误判断.md`](references/01-错误判断.md) |
| **B · 工具调用** | 「对每个 Function Call 标注 Correct / Incorrect」 | 逐步判定表 + 一份正确 Trace | [`references/02-工具调用.md`](references/02-工具调用.md) |
| **C · 白盒测试** | 「设计 Rubric，判 PASS/FAIL，算 Ground Truth」 | Rubric 表 + 失败项 + GT 计算结果 | [`references/03-白盒测试.md`](references/03-白盒测试.md) |

**怎么判断是哪个场景：**

- 问"哪里错了" → A
- 问"这一步对不对" → B
- 问"怎么评""标准是什么" → C

**场景 A 和 B 最容易混**，区别在第 3 节。

## 1. 共用部分：先读 Schema

三种场景都从这一步开始，且不能跳。

| # | 动作 | 找什么 |
|---|---|---|
| 1 | 数必选/可选 | 没默认值、没 `?` 的必须传 |
| 2 | 看参数形态 | id 还是 path？相对还是绝对？单值还是列表？ |
| 3 | 找名不符实 | `copy` 保原文件 / `move` 移走原文件——名字像，语义反 |
| 4 | **查返回值够不够** | 返回值里没有的字段，不能拿来做判断 |
| 5 | 圈副作用 | "实际读取/下载/修改/删除/创建"——都是 Side Effect |

**Tool Semantics 那一段是判分依据，不是背景介绍。** 每一句都在"排除"或"允许"某种判定：

- 写了「query 同时搜标题和正文」→ 用 query 做"只匹配标题"就是工具能力误用
- 写了「read 不改变已读状态」→ 读正文是安全的，不算 Side Effect

## 2. 共用部分：把指令拆成约束台账

不管哪个场景，第一步都是这个。跳过它，后面全靠感觉。

把用户指令**逐句**拆成编号断言：

```
C{n}｜{原文要点 + 判定口径}｜{粗分类}
```

例：

```
C1｜只处理当前 Inbox，不看已归档；folder="inbox" 可保证｜Scope
C2｜标题含完整字符串 [Atlas]，大小写不敏感；Atlas Weekly Update 不算｜Filtering
C10｜不得修改已读/标签/归档/删除任何状态｜Side Effect
```

**唯一检验标准：第三个人拿着这条，能独立判出对错。** 写不出判定口径，说明还没读懂。

拆的时候盯三把尺子：

| 尺子 | 盯什么 |
|---|---|
| **边界** | `<` vs `<=`、`>` vs `>=`、"一级目录"vs"递归"、"全部"vs"保留后" |
| **字符串** | 完整短语 vs 分词出现、大小写、包裹符号、前缀匹配 |
| **副作用** | 读 / 写 / 半读半写（下载） |

## 3. 场景 A 与 B 的分界：三套词汇怎么对应

两套术语是**同一套标准的粗细两档**，不是两套东西。

### 错误类型对照

| 粗分类（场景 A · 错误判断） | 细分（场景 B · 工具调用） |
|---|---|
| `Instruction Understanding` | —（Q2 无对应，最接近 Parameter 或 Sequence） |
| `Scope` | `Invalid Scope` |
| `Filtering` | `Temporal Filter Error` / `File Type Error` / `Content Matching Error` |
| `Tool-use` | `Tool Selection` |
| `Parameter` | `Parameter Error` |
| `Workflow` | `Dependency Error` / `Sequence Error` |
| `Side Effect` | `Premature Side Effect` / `Wrong Side Effect` |
| `Output Format` | `Output Error` |
| `Other` | — |

**记忆方式**：场景 A 是"这条约束被违反了"，场景 B 是"这个调用错在哪一步"。同一个错，A 记 `Filtering`，B 记 `Content Matching Error`。

### 「多余」怎么处理——两套词汇的差别在这

| 场景 | 多余但合规的步骤怎么办 |
|---|---|
| **A · 错误判断** | **不记**。没有约束编号支撑的不写进清单 |
| **B · 工具调用** | **标 `Unnecessary`**。它有独立取值，不算 Incorrect |

`Unnecessary` 这个取值的作用就是：**既不冤枉它，也不假装没看见。** 场景 A 用"不记"达到同样效果。

**搞错这一点，就是过度标记。**

## 4. 共用部分：严重程度

场景 A 和 C 要用，场景 B 不需要（B 只判 Correct/Incorrect）。

按顺序问，**第一个"是"就停**：

```
第 1 问：有不可撤销的副作用吗？（删/移/覆盖/发送/外传）
        ├─ 能撤销   → Major
        └─ 不能撤销 → Critical
第 2 问：没动东西，但结果内容错了吗？ → Major
第 3 问：只是形式不对？             → Minor
第 4 问：只是"没必要"？             → 不记
```

一句话：**真实生产环境里，我要不要回滚？** 要回滚 → Critical；要重做 → Major；改一下 → Minor。

## 5. 八条铁律

1. **读取 ≠ 采纳**。范围内 + 读了 + 排除 = 对；读了并纳入 = 错在"纳入"；范围外读了 = 错在"读"。
2. **不必要 ≠ 违规**。A 场景不记，B 场景标 `Unnecessary`。
3. **根因 ≠ 后果**。一条根因记一次，后果写进理由。
4. **报错 ≠ 静默成功**。后者更危险——它不会被发现。
5. **能跑通 ≠ 用对了**。工具执行成功不等于语义正确。
6. **"不区分大小写"是放宽，不是跳过**。仍然要匹配，只是不敏感。
7. **包含 ≠ 开头**。`Re: [Atlas] Weekly` 含 `[Atlas]`，但不由它开头。
8. **"确认后可以做" ≠ "现在可以做"**。有时间条件的授权，必须卡在时间点之后。

## 6. 交付前自检

- [ ] 选对了场景（A 出清单 / B 出判定表 / C 出 Rubric + GT）
- [ ] 每条错误都挂了约束编号（C几）
- [ ] 没有把"多余但合规"的步骤记成错误（A），或漏标 `Unnecessary`（B）
- [ ] 所有 `<` `<=` `>` `>=` 逐字核对过
- [ ] Side Effect 类单独列了；Premature 类标了 Critical
- [ ] 根因只记一次，后果没重复计
- [ ] 一个行为只有一个主类型
- [ ] 每个数字都能追溯到具体行
- [ ] 理由里没有"我觉得""看起来""应该没问题"
- [ ] 严重度与"要不要回滚"的判断一致

## 参考

| 文件 | 用途 |
|---|---|
| [`references/01-错误判断.md`](references/01-错误判断.md) | 场景 A：九类错误定义、六字段输出 |
| [`references/02-工具调用.md`](references/02-工具调用.md) | 场景 B：四值判定、十一类细分、正确 Trace 写法 |
| [`references/03-白盒测试.md`](references/03-白盒测试.md) | 场景 C：Rubric 六字段、PASS/FAIL、GT 计算 |
| [`references/速查卡.md`](references/速查卡.md) | 一页纸，三场景速查 |
| [`references/评测集设计.md`](references/评测集设计.md) | 从零造评测集，含生成提示词 |
