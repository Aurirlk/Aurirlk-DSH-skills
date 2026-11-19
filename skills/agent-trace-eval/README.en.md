# agent-trace-eval

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Evaluate whether an agent's tool-call trace **actually follows the user's instruction** — not "did it run", but "did it do what was asked, and nothing it wasn't".

The method in one line: **turn every sentence of the instruction into a checkable constraint, then flag only the behaviors a constraint can prove.**

Terminology follows the standard Agent instruction-following annotation vocabulary rather than inventing a new one: `Instruction Understanding` / `Scope` / `Filtering` / `Tool-use` / `Parameter` / `Workflow` / `Side Effect` / `Output Format`; `Correct` / `Incorrect` / `Unnecessary` / `Cannot Determine`.

## Three modes

The same trace, three different questions, three different deliverables — **mixing them up is a wrong answer.**

| Mode | Typical ask | Output | Doc |
|---|---|---|---|
| **A · Error location** | "Find all clear errors in the trace" | Error list (6 fields) | [01](references/01-错误判断.md) |
| **B · Tool calls** | "Label each Function Call Correct / Incorrect" | Per-step verdicts + correct trace | [02](references/02-工具调用.md) |
| **C · White-box** | "Design rubrics, judge PASS/FAIL, compute ground truth" | Rubric table + failures + GT | [03](references/03-白盒测试.md) |

**How to tell them apart**: "where is it wrong" → A; "is this step right" → B; "how should this be judged" → C.

## A vs B

The two vocabularies are **the same standard at two granularities**:

| Coarse (A) | Fine (B) |
|---|---|
| `Scope` | `Invalid Scope` |
| `Filtering` | `Temporal Filter` / `File Type` / `Content Matching` |
| `Tool-use` | `Tool Selection` |
| `Workflow` | `Dependency Error` / `Sequence Error` |
| `Side Effect` | `Premature` / `Wrong Side Effect` |
| `Output Format` | `Output Error` |

The same defect is `Filtering` in A and `Content Matching Error` in B.

**Steps that are "unnecessary but compliant"**: omit them in A; label them `Unnecessary` in B — it is a first-class verdict, not `Incorrect`. Getting this wrong is over-flagging.

## Five steps

```
1 Read schema   → required/optional · parameter shape · misleading names · return sufficiency · side effects
2 Build ledger  → C1…Cn, each a checkable assertion
3 Split steps   → S1…Sm
4 Cross-check   → record only violations backed by a C number
5 Grade + write → three-sentence rationale + executable fix
```

## The four rules that matter most

- **Reading ≠ adopting.** In scope + read + excluded = correct; read and included = the error is in *inclusion*; out of scope but read = the error is in *reading*.
- **Unnecessary ≠ violation.** No constraint number, no entry.
- **Root cause ≠ consequence.** Record the root cause once; consequences go in the rationale.
- **Error ≠ silent success.** The latter is more dangerous — it goes unnoticed.

## What the output looks like

```
ID: E1
Constraint: C10 | Must not modify any mailbox state — read, label, archive, delete | Side Effect
Agent behavior: S6 | Ran delete_mail on mail from noreply@
Error type: Side Effect
Severity: Critical
Rationale: The user explicitly stated that noreply@ mail should be ignored — "ignore" means
           exclude from the summary, not delete. Mail deletion is irreversible, so Q1 of the
           decision tree makes it Critical.
Fix: Do not call delete_mail; filter by sender prefix when building the result set.
```

**The rationale must be three sentences**: which constraint / why this severity / whether anything else overlaps. Drop one and it becomes "I think".

## Included files

| File | Purpose |
|---|---|
| [`references/01-错误判断.md`](references/01-错误判断.md) | Nine error types, six-field output, five common failure points |
| [`references/02-工具调用.md`](references/02-工具调用.md) | Four-value verdicts, eleven sub-types, writing the correct trace |
| [`references/03-白盒测试.md`](references/03-白盒测试.md) | Rubric six fields, PASS/FAIL, eight-step ground-truth computation |
| [`references/速查卡.md`](references/速查卡.md) | One-page cheat sheet covering all three modes |
| [`references/评测集设计.md`](references/评测集设计.md) | Building an eval set from scratch, with a generation prompt |

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original. Abstracted from real Agent instruction-following annotation workflows: schema reading → constraint ledger → step-by-step trace judgment → rubric design → ground-truth computation.
