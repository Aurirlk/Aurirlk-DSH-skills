# nl2sql-analyst

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Querying a database in plain language.

**The hard part is not translating a sentence into SQL. It is reading the right table, not leaking other tenants, stating the definition, and never inventing a number when the result is empty.**

## Three ways this goes wrong in production

**① You query someone else's data**

You are building analytics for company A. The user asks for last month's order count.

The SQL is beautiful and it runs. But the `WHERE` clause is missing the tenant predicate —

**so B's and C's orders are included.** That is not a bug. That is a security incident.

**② The number is right, the definition is wrong**

The user asks for the conversion rate. You compute `feed / delta` and get 2.8.

Finance computes 1.4.

**Neither of you is wrong — the word "conversion rate" maps to two different tables in the system.** You picked the wrong one.

**③ The result is empty, so it invents one**

There are no records for this month. The assistant sees an empty result and adds:

> "The conversion rate this month is approximately 1.5, which is normal."

**It made that up.** And the user will probably believe it.

Those three are the holes this skill plugs.

## Six steps

```
① Establish who, which period, which object, which metric
② Translate the plain-language term into a table and a formula
③ Generate SQL (safely)
④ Execute
⑤ Check the result; explain anomalies
⑥ Pick a chart
```

## Step 1 — Pin down four things

| Pin down | If you skip it |
|---|---|
| **Which tenant / which site** | That is incident ① above |
| **Which period** | "Recently" and "this week" must become concrete dates |
| **Which object** | A specific point, or the whole aggregate |
| **Which metric** | If ambiguous, offer two and let the user choose |

**Always echo the time range back** ("2026-11-13 to 2026-11-19"). Correcting it here is far cheaper than arguing after the report is out.

## Step 2 — Translate the term into a table and a formula

Three things must be written, not two: **which table to read, how to compute it, and which table NOT to read.**

**The third is the one people skip, and the one that causes incident ②.**

Saying "daily feed comes from `feeding_log`" is not enough — the model may still reach for the camera-event table, because that one also has a field called `feed`.

So every easily-confused metric needs an explicit "do not read from":

| Term | Read from | Definition | **Not from** |
|---|---|---|---|
| Daily feed | `feeding_log` | `SUM(feed_weight)` aggregated by day | **not the camera-event table** |
| Conversion rate | `feed_log` + `biomass` | `SUM(feed) / (end − start)` | guard a zero denominator |
| Achievement rate | `target` + `actual` | `actual / target` | say "no target set" when null |

## Step 3 — Four safety lines for the SQL

### 1. Every table carries the tenant predicate

**Not just the main table. Every joined table needs it in `WHERE`.**

```sql
WHERE t.tenant_id = :tenant_id
  AND t.base_id = :base_id   -- only when the context specifies one
```

One missed join and you have incident ①.

### 2. Read-only

`SELECT` only. No `INSERT` / `UPDATE` / `DELETE` / `DROP`.

**Enforce this in the tool layer, not just in the prompt.** Prompts can be talked around.

### 3. Guard every division

```sql
SUM(a) / NULLIF(SUM(b), 0)
```

Unguarded, it will blow up — and not every time. **Intermittent failures are worse than consistent ones.**

### 4. Bind parameters, never concatenate

Concatenation is an open door for injection.

## Step 4 — When it is empty, say so

**This is the most frequently broken rule and the least tolerated.**

| ✅ Right | ❌ Wrong |
|---|---|
| "No records under the current conditions; check the identifier or whether data has been entered" | Inventing a number with "typically", "generally", "around" |

**An empty result is data, not a failure.** It tells you either the filter is wrong or the data entry is missing.

You can usually add something more useful: "This site has had no records for three days; worth checking the entry process."

## Step 5 — Explain anomalies, but only from data you retrieved

If a value is clearly off (a sudden drop, a spike, an absurd ratio), **don't just hand over the number**.

Attach the contemporaneous environment data:

```
Metric: conversion rate 2.8 (historical range 1.2–1.6)
Same period: average temperature 12°C (22°C seasonally), input unchanged
Explanation: lower temperature reduced efficiency, but input was not reduced,
             so the ratio rose
```

**But the explanation must rest on retrieved data.** "Probably seasonal" is not an explanation — it is a guess.

## Step 6 — Choose charts by data shape, not by looks

| Data shape | Chart |
|---|---|
| One metric over time | line |
| Several objects compared | grouped bar |
| Two metrics, different units | dual-axis combo |
| Composition (more than 6 categories) | stacked bar |
| Single target progress | gauge |

**A chart is only a vehicle. State the conclusion in one sentence — and never more confidently than the data.**

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin

Original. Extracted from a smart-fishery dashboard's NL2SQL skill — **all business fields and metric definitions removed; only the pipeline, the safety boundary, and the honesty rules kept**.
