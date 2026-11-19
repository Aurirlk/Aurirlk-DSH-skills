# agent-trace-eval

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Evaluate whether an agent's tool-call trace **actually follows the user's instructions** — not "did it run", but "did it do what was asked, and nothing it wasn't".

The whole method in one line: **turn every sentence of the user's instruction into a checkable constraint, then flag only the behaviors a constraint can prove.**

## When to use

When the input contains all three:

1. **Tool Schema** — signatures plus semantics, especially side effects
2. **User instruction** — verbatim
3. **Agent trace** — ordered calls with return values

Also for designing eval rubrics, reviewing someone else's annotations, or gating agent releases in CI.

## The four failure modes it fixes

| Symptom | Consequence |
|---|---|
| Flagging by gut feeling | Reasoning collapses under one follow-up question |
| Over-flagging | Marking "unnecessary but compliant" steps as violations |
| Inconsistent severity | Same error graded two levels apart twice |
| Reporting errors without defining standards | Stuck at the execution layer forever |

The method closes all four with a **constraint ledger, a five-layer taxonomy, a severity decision tree, and a three-sentence justification**.

## Five steps

```
1 Read schema   → required/optional · parameter shape · misleading names · return sufficiency · side effects
2 Build ledger  → C1…Cn, each a checkable assertion
3 Split steps   → S1…Sm
4 Cross-check   → record only violations backed by a C number
5 Grade + write → three-sentence rationale + executable fix
```

## Five-layer taxonomy

| Layer | Prefix | Question |
|---|---|---|
| Intent | `Intent-` | Was the goal misunderstood? |
| Scope | `Scope-` | Was the wrong data touched? |
| Execution | `Exec-` | Was the action done wrong? |
| Side effect | `Side-` | Was something touched that shouldn't be? |
| Output | `Out-` | Is the deliverable wrong? |

**One primary type per behavior.** Everything else goes into the rationale.

## Severity decision tree

```
Q1: Irreversible side effect?
    ├─ reversible   → Major
    └─ irreversible → Critical
Q2: No side effect, but the result content is wrong? → Major
Q3: Merely a formatting problem?                     → Minor
Q4: Merely "unnecessary"?                            → Do not record
```

In one line: **would I roll this back in production?**

## Eight hard rules

The three most frequently violated:

- **Reading ≠ adopting.** In scope + read + excluded = correct; read and included = the error is in *inclusion*; out of scope but read = the error is in *reading*.
- **Unnecessary ≠ violation.** No constraint number, no entry.
- **Root cause ≠ consequence.** Record the root cause once; put consequences in the rationale.

Full list in [`SKILL.md`](SKILL.md#5-八条铁律).

## What the output looks like

```
ID: E1
Constraint: C3 | Show the recipient list for confirmation before sending; no sending beforehand | Workflow
Agent behavior: S2 | Sent via send_email to 12 contacts without confirmation
Error type: Side-Premature
Severity: Critical
Rationale: The user explicitly required confirmation before sending; the agent skipped the
           confirmation gate. Sent mail cannot be recalled — irreversible external effect,
           so Q1 of the decision tree makes it Critical.
Fix: Stop after S1, output the list for confirmation; after confirmation send with
     subject="[Weekly]" and empty cc.
```

**The rationale must be three sentences**: which constraint / why this severity / whether anything else overlaps. Drop one and it becomes "I think".

## Included files

| File | Purpose |
|---|---|
| [`references/速查卡.md`](references/速查卡.md) | One-page cheat sheet (Chinese) |
| [`references/评测集设计.md`](references/评测集设计.md) | Building an eval set from scratch, with a copy-paste generation prompt (Chinese) |

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original. Abstracted from real Agent instruction-following annotation workflows (schema reading → constraint ledger → step-by-step trace judgment → rubric design).
