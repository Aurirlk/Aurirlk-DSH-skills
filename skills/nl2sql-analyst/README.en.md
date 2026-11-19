# nl2sql-analyst

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Natural-language querying with metric attribution.

**The hard part was never "generate SQL" — it is querying the right table, holding the boundary, stating the definition, and never inventing when the result is empty.**

## When to use

Users ask business questions in natural language and expect a query plus an explanation: BI querying, dashboard extraction, operational metrics.

Especially for multi-tenant systems, easily-confused definitions, and cases where an empty result must not be filled in.

## Six steps

```
① intent & context → ② semantic mapping → ③ safe SQL → ④ execute → ⑤ validate & attribute → ⑥ chart
```

## Four safety rules

| # | Rule | Why |
|---|---|---|
| 1 | Inject scope predicates into the main table **and every joined table** | One missed join is a cross-tenant leak |
| 2 | `SELECT` only | Enforce in the tool layer, not just the prompt |
| 3 | Wrap ratio denominators in `NULLIF(b, 0)` | Division by zero is a guaranteed failure |
| 4 | Parameterise; never concatenate | Injection |

**A cross-tenant query is a security incident, not a bug. There is no room to negotiate this one.**

## Semantic mapping needs a "do not read from" column

Saying where to read from is not enough — **the model will grab whichever table happens to have a related field.**

| Term | Source | Definition | **Not from** |
|---|---|---|---|
| Daily feed | `feeding_log` | `SUM(feed_weight)` | **not the camera-event table** |
| Conversion ratio | `feed_log` + `biomass` | `SUM(feed)/(end_b−start_b)` | guard the denominator |

## Honesty rules

**Empty result**:

- ✓ "No records under the current conditions; check the identifier or whether data was entered"
- ✗ inventing a number with "typically" or "generally"

**This is the most frequently broken and least tolerated rule.**

**Anomalous values**: don't report the number alone — attribute it against contemporaneous environment data, and ground that attribution in retrieved data, not common sense.

## Pick charts by dimension, not by looks

| Data shape | Chart |
|---|---|
| Single metric over time | line |
| Multi-object comparison | grouped bar |
| Two metrics, different units | dual-axis combo |
| Composition (>6 categories) | stacked bar |
| Single-value target | gauge |

**A chart is only a vehicle. State the conclusion in one sentence — and never more confidently than the data.**

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original. Extracted from a smart-fishery dashboard's NL2SQL skill — **all aquaculture fields and metric definitions removed; only the pipeline, safety boundary, and honesty rules kept**.
