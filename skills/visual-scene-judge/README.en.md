# visual-scene-judge

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

A general framework for judging scenes from surveillance imagery.

**Core claim: when image judgment fails, it is usually not because the model saw wrong, but because nobody first stated what could be seen.**

## When to use

- Surveillance footage → behaviour / state / risk verdicts
- Frame sequences → progression-stage judgment
- No labelled baseline, degraded imagery, costly false positives

## Five layers

```
1 Input parsing  → count, timestamps, business context, noise filtering
2 Boundary claim → distance / lighting / occlusion / frame rate / resolution
3 Invariants     → directionality / coherence / temporal gradient / residual dynamics
4 Progression    → onset → peak → decay → termination
5 Differential   → pair every high-risk misread with an observable discriminator
```

## Three key judgments

### ① State what you cannot see, first

> "This assessment relies on a distant overhead camera; individual detail is not resolvable. Conclusions below are based only on group movement and surface disturbance."

After that sentence, every downstream conclusion is bounded automatically. **That is protection, not a disclaimer.**

### ② When dimensions conflict, report the conflict

**Do not vote. Do not force a consensus.**

> "Directionality suggests active approach, but coherence shows isolated individuals. The two conflict; leaning toward a local anomaly rather than a state change."

**Reporting conflict is worth more than forcing agreement.**

### ③ For progression, shape beats absolute value

- Smooth decay → natural completion
- Cliff-edge stop → external interference
- Overlong plateau → abnormal stagnation
- Repeated rise and fall → cyclic fault

This transfers to any time-series scenario.

## Without a baseline, use relative gradients

No historical baseline means **no absolute thresholds**:

- ✗ "disturbance height > 20cm means high intensity"
- ✓ "disturbance area expanded more than 3× relative to the first frame"

Two rules: state the baseline; never convert the ratio into physical units.

## Five anti-hallucination rules

1. Unclear → write "cannot be resolved"
2. Never infer long-term trends from a single frame
3. **Never turn "not observed" into "does not exist"** — a different observation condition
4. Never invent identifiers, timestamps, or counts
5. Every conclusion must point to a region of the image

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original. Extracted from four vertical aquaculture-monitoring skills (species-specific judgment, cross-species judgment, disease triage, night security) — **all domain nouns removed, only the judgment skeleton kept**.
