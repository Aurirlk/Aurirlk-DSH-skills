# see-analyze-act

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Three-stage structured domain diagnosis: **observe · attribute · act**.

The same fact can be written as a guess or as a diagnosis. The difference is structure — and the value of this framework is not "three steps", it is that **every stage forces you to declare your own limits**.

## When to use

Drawing actionable conclusions from limited evidence: equipment triage, fault or disease diagnosis, data anomaly attribution, incident post-mortems.

**Especially when evidence is thin but a recommendation is still required** — exactly where invention starts.

## The three stages

| Stage | Mandatory action | Failure mode |
|---|---|---|
| **Observe** | Declare the visibility boundary first, then record only observable facts, separating observation from inference | Confident conclusion with no traceable basis |
| **Attribute** | Three layers: direct cause → enabling conditions → systemic cause | The same problem keeps recurring |
| **Act** | Two levels: stop-the-bleeding (doable today) + systemic hardening (change the mechanism) | Long analysis, nothing lands |

## Observe, in four moves

```
1 Declare the boundary   → what can be seen, what cannot, what data is missing
2 Record facts only      → write "what is in the frame", not "what it means"
3 Split observation from inference → Observation / Inference (confidence) / Cannot confirm
4 Give 1–3 candidate directions    → one is a bet, ten is a shrug
```

## Attribute, in three layers

| Layer | Answers |
|---|---|
| Direct cause | What immediately triggered this |
| Enabling conditions | What environment allowed it to happen |
| Systemic cause | Why that condition persists |

**Stopping at the direct cause is the most common shortcut** — it explains "what happened", not "why it keeps happening".

## Act, in two levels

- **Stopgap**: doable today, with an owner and a completion criterion
- **Systemic**: change the mechanism, not remind the human

> If your systemic fix is "more training" or "raise awareness", you have not found the systemic cause yet.

## Four grounding rules

1. **Don't state what you cannot see** — write "cannot confirm"
2. **Trust only four sources**: direct observation / system telemetry / mounted knowledge base / explicit user input
3. **Never invent identifiers** — use "the current object" when none was provided
4. **Empty is empty** — "no records found", never "typically"

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original. Abstracted from the eight vertical skills of a smart-aquaculture dashboard project — **every one of them depended on this methodology, yet none of them defined it**. This fills in the missing shared layer.
