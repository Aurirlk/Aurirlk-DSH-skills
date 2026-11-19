# systematic-rca

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Systematic root-cause diagnosis: **fact extraction → hypotheses & elimination → root-cause tracing → graded action & prevention**.

The same material can be written as a guess or as a diagnosis. The difference is not how much information you have — **it is the order**.

## The iron law

> **No remediation advice before fact extraction and attribution are complete.**

Once you suspect "it might be X", every subsequent piece of evidence bends toward X. Evidence-first is not procedural fussiness — **it is the only defence against confirmation bias**.

Second law: **when evidence is insufficient, halt and request a specific missing dimension — do not fill the gap with speculation.**

## Four stages

| Stage | Mandatory action | Failure mode |
|---|---|---|
| **① Facts** | Full scan → separate observation from inference → 1–3 hypotheses with confidence | Observations and guesses written together |
| **② Eliminate** | Separate direct cause from systemic cause → **give a low-cost discriminator** | Vague "could be A or B" |
| **③ Root cause** | Descend the causal chain | Stopping at the direct cause |
| **④ Action** | Stopgap / fix / prevention | Prevention written as "be more careful" |

## The most underrated stage: discriminators

When two hypotheses are viable and current evidence cannot separate them, **vagueness is not allowed**.

**Give one action that is executable, takes under five minutes, and yields a binary result.**

| ✗ Vague | ✓ Discriminating |
|---|---|
| "Could be cache, could be the database" | "Disable cache and rerun: still slow → cache ruled out" |
| "Could be network, could be the app" | "curl from the same rack: fast → network ruled out" |
| "The docs are probably unclear" | "Have a newcomer read only the doc and retell it: wherever they stall is the gap" |

## Elimination table

| Hypothesis | Supporting | **Contrary** | Confidence | Discriminator |
|---|---|---|---|---|
| A | … | … | high | — |

**The "contrary" column may not be empty.** An empty column means you only looked for confirmation.

## What counts as a root cause

- **Actionable** — someone can change it
- **Falsifiable** — an experiment can refute it
- **Explains everything** — not just part of the symptom

## Three hard requirements for prevention

1. **Change the mechanism, not the human** — "pay more attention" is not a fix
2. **Cover at least two of: environment / monitoring / process**
3. **Verifiable** — answer "how do we know it works"

## Circuit breaker

Missing key evidence, two equally plausible hypotheses, contradictory evidence, or risk beyond your judgment: **stop producing a plan and ask for evidence.**

> "Currently confirmed: ____. Cannot distinguish ____ from ____. Please supply ____. Meanwhile, do ____ (a zero-risk stopgap)."

**Breaking the circuit is not abandoning the user** — always leave a zero-risk interim action.

## Four application profiles

| Scenario | What counts as "evidence" here | Doc |
|---|---|---|
| **Code development & testing** | Code facts, runtime output, test results | [01](references/01-代码开发测试.md) |
| **Docs & video writing** | Source material, reader feedback, comprehension failures | [02](references/02-文档与视频.md) |
| **Incident forensics** | Timeline, logs, multiple accounts | [03](references/03-事件溯源.md) |
| **Bug root-cause replies** | Reproduction steps, environment, symptom records | [04](references/04-Bug根因回复.md) |

Each profile covers: the domain's first principle, stage-by-stage actions, its characteristic failure modes, and an output sample.

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original. The four-stage protocol is distilled from multimodal RCA practice and generalised across domains; the four application profiles were written for this repository.
