# visual-scene-judge

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Judging what happened from surveillance footage.

**The biggest trap is not seeing it wrong — it is drawing a conclusion without first saying what could actually be seen.**

## A real mess to start with

Late at night. Something dark is moving on the infrared feed.

Is someone struggling in the water, or is it just wind on the surface?

- Call it "someone is drowning" — if it was a wave, you mobilise rescue at 2am and the whole team hears about it.
- Call it "nothing" — if it really was a person, that is not a joke anyone laughs at.

**Same frame. Two readings. Costs that differ by orders of magnitude.**

The hard part is not "what do you see". It is **"this image cannot resolve what you would need to see"**.

The first thing this skill does is make you say that out loud.

## Step 1 — State what you cannot see

Before any conclusion, say this:

> "This assessment relies on a distant overhead camera. Individual detail is not resolvable. What follows is based only on group movement and surface disturbance."

After that sentence, everything downstream is automatically bounded.

**That is protection, not a disclaimer.** It tells the reader how much weight to give your conclusion.

Five things to declare:

| Declare | Why it matters |
|---|---|
| Distance | Far away means group behaviour only, no individuals |
| Lighting | Infrared has no colour; anything relying on colour is void |
| Occlusion | Glare, rain, and fog make entire regions unjudgeable |
| Frame rate | Wide sampling cannot judge instant motion, only trends |
| Resolution | Too blurry means small detail is out of scope — don't force it |

## Step 2 — Cross-check four independent angles

Judging on one feature goes wrong constantly.

**Require four independent angles to point the same way before concluding.**

| Angle | Ask |
|---|---|
| **Where is it going** | Gathering toward a centre, or scattering outward? |
| **How orderly** | Moving as one line, or independently, with stragglers? |
| **How fast it changed** | Gradual rise and fall, or an instant jump? |
| **What is left behind** | Is the input consumed quickly, or piling up? |

**When the four disagree — say so.**

Do not vote. Do not force a consensus.

> "Directionality suggests active approach, but coherence shows isolated individuals. They conflict; leaning toward a local anomaly rather than a state change."

**Reporting the conflict is worth far more than forcing agreement.**

## Step 3 — Read the speed and the shape

One frame tells you "what it looks like now". **A sequence tells you "where it is heading".**

The useful signal is not magnitude. It is **shape**:

| Shape | Usually means |
|---|---|
| Smooth rise, smooth fall | Normal start, normal finish |
| Sudden stop (cliff edge) | Something external intervened |
| Stuck at a high plateau | Jammed; not normal |
| Repeated rise and fall | Cyclic fault |

**This transfers to almost any time-series scenario**, not just video.

## Step 4 — Pair every likely misread with a discriminator

This is the most practical part of the skill.

List the situations most often misjudged in this domain, and write one line each:

**"It looks like X — but if it is really Y, you will also see Z."**

| What you see | Commonly misread as | How to tell |
|---|---|---|
| Vigorous movement | Abnormal agitation | Gathering inward = normal high-intensity work; scattering = startled |
| Perfectly still surface | Empty / nothing there | Look for small sporadic disturbance. **Quiet ≠ absent** |
| Motion stops abruptly | System failure | Check whether any external input changed. Smooth decline usually means it finished naturally |
| One small anomaly | Whole thing is abnormal | Check the share of stragglers. Under 5% is usually an individual |

**One hard requirement: the discriminator must be observable.**

"Note the difference" is not a discriminator. **"Check whether it gathers or scatters" is.**

## When you have no baseline

Often there is no history, and no idea what counts as "a lot".

**Never invent an absolute threshold:**

| ❌ Invented | ✅ Checkable |
|---|---|
| "Disturbance above 20cm is high intensity" | "Disturbance area grew more than 3× versus the first frame of this sequence" |

Two rules for relative measures:

1. **Name the baseline** (first frame / this site's history / the adjacent period)
2. **Never convert the ratio into physical units** (3× is 3×, not "about 20 centimetres")

## Five never-dos

1. Unclear → write "cannot be resolved". Do not fill it in.
2. Never infer a long-term trend from a single frame.
3. **Never turn "I did not see it" into "it was not there"** — those differ by an entire observation condition.
4. Never invent identifiers, timestamps, or counts.
5. Every conclusion must point back to a region of the image. If it cannot, lower the confidence.

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin

Original. Extracted from four vertical aquaculture-monitoring skills (species-specific judgment, cross-species judgment, disease triage, night security) — **all domain nouns removed, only the judgment skeleton kept**.
