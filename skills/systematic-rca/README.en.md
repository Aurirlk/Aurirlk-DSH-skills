# systematic-rca

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

When people get root-cause analysis wrong, it is rarely because they are not smart. **It is because they do it in the wrong order.**

## A scene you have definitely been in

Production is throwing errors. You open the logs, glance at two lines, and your brain says: "cache didn't refresh."

So you look for evidence — and find three things that support it. Now you are sure.

You fix it. It still fails.

Two more hours of digging: the connection pool was exhausted. **Those first two hours were spent collecting reasons for a conclusion you had already reached.**

That is not a skill problem. Once a hypothesis forms, your eyes only see what supports it.

This skill puts the order back.

## The order

```
① See what actually happened   ② List the possibilities
③ Rule them out, one by one    ④ Only then act
```

**Steps ② and ③ are not optional, and ④ must not come first.**

## Rule one: look before you touch

> **No fix is offered before the facts are laid out and the cause is reasoned through.**

That sounds obvious. It is also the rule most often broken — because the customer is chasing you and your manager is asking.

Which brings rule two:

> **When evidence is thin, stop and ask for it. Do not paper over the gap with "should be" or "probably".**

Stopping is not embarrassing. Guessing and fixing the wrong thing is.

## What each step looks like

### Step 1 — Separate what you saw from what you think

This is the dividing line for the whole exercise.

| This is useless | This works |
|---|---|
| "Timeouts mean the database is down" | Symptom: P99 went from 80ms to 3200ms<br>Inference: downstream dependency issue (confidence: medium) |

**A symptom must be checkable by someone else**: which layer, what time, how far off, compared to what.

Then list **1 to 3** possibilities, each with a confidence level.

- One possibility = a bet
- Ten possibilities = no answer

### Step 2 — Find a way to tell them apart

**This is the most valuable step in the whole skill, and the one most often skipped.**

When two explanations both fit and the evidence cannot separate them, the standard move is:

> "Could be the cache, could be the database."

**That is a cop-out.** The other person cannot act on it.

What actually helps is an action:

> "Turn the cache off and rerun. Still slow → cache is ruled out."

**A good discriminator meets three conditions**: you can do it yourself, it takes under five minutes, and the result is binary.

More examples:

| Can't tell apart | One action separates them |
|---|---|
| Cache or database | Disable cache and rerun: still slow → not cache |
| Network or application | curl from the same rack: fast → not network |
| Code or environment | Minimal reproduction locally: reproduces → code; not → environment |
| The document is unclear | Have someone uninvolved read only the doc and retell it: wherever they stall is the missing piece |

### Step 3 — Dig to the bottom

**Three gates before something counts as a root cause:**

| Gate | Question |
|---|---|
| Actionable | Can anyone change it? If not, it is weather, not a cause |
| Falsifiable | Can you say how it would be disproved? |
| Complete | Does it explain everything, not just part of it? |

Then walk the chain with four questions:

```
What triggered it?
→ Why was it allowed to trigger?
→ Why didn't the tests catch it?
→ Why wasn't it noticed quickly after release?
```

**Questions three and four are the ones people skip, and the ones worth the most.**

Answer only the first → you fixed a spot.
Answer through the third → you added a class of tests.
Answer through the fourth → you changed how you ship.

### Step 4 — Act at three levels

| Level | Does what | Requirement |
|---|---|---|
| **Stop** | Stanch the bleeding | Doable now, cheapest option, reversible if possible |
| **Fix** | Remove the cause found in step 3 | Step by step, with a completion check |
| **Prevent** | Stop it recurring | Change the mechanism, not the person |

## One hard rule for prevention

**"Pay more attention" and "raise awareness" count as nothing written.**

Real prevention looks like this:

| Dimension | Examples |
|---|---|
| Environment | Version pinning, config validation, lockfiles |
| Monitoring | Key-path instrumentation, error-rate alerts, slow-query thresholds |
| Process | CI gates, staged rollout, review checklists |

**Cover at least two of the three.** Monitoring without process means the next entry point gets through. Process without monitoring means users find your bugs for you.

## When you can't tell — stop, but don't walk away

> "Confirmed: ____. Cannot yet separate ____ from ____. Please do ____ (exactly how to collect it). Meanwhile, do ____ (a zero-risk action)."

**Stopping without an interim action is abandoning the user. Stopping with one is being responsible.**

## Four situations, four different ideas of "evidence"

| Situation | What counts as evidence here | Read |
|---|---|---|
| Writing and testing code | Code facts, actual runtime output, test results | [Code](references/01-代码开发测试.md) |
| Writing docs and video | Source material, reader feedback, where they stall | [Docs & video](references/02-文档与视频.md) |
| How an incident happened | Timeline, logs, each party's account | [Incident forensics](references/03-事件溯源.md) |
| Replying to a bug report | Reproduction steps, environment, symptom record | [Bug replies](references/04-Bug根因回复.md) |

Each one covers: the domain's single most important principle, how the four steps apply, where people go wrong, and a sample you can copy.

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin

Original. The four-step protocol comes from multimodal root-cause diagnosis practice, later generalised across domains; the four situation profiles were written for this repository.
