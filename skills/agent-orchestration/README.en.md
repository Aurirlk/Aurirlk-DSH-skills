# agent-orchestration

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Multi-scenario agent orchestration: **routing, memory, persona, follow-ups**.

What separates an assistant from a model that merely answers: it **knows who should answer, remembers, speaks to the right medium, and knows the next step**.

## When to use

- Designing an agent that coordinates several skills
- Debugging "wrong skill answered", "context lost mid-conversation", "alerts are too chatty"
- Serving both a structured terminal (dashboard, card) and a chat terminal from one capability set

## Four-dimension governance

| Dimension | Answers | Failure mode |
|---|---|---|
| **Goal** | Task boundary and permitted input sources | External knowledge passed off as system data |
| **Workflow** | Fetch data → retrieve knowledge → reason | Skipping steps, answering from memory |
| **Output** | Which terminal, which format and register | Chit-chat inside a dashboard |
| **Guard** | What must never happen | Invented data, privilege escalation, unsafe advice |

**Write all four down explicitly** — a prompt is more reliable than a human remembering under pressure.

## Three routing rules

1. **Coarse filter first.** Decide "is the target present" before "what state is it in". Reversed, you end up reasoning hard over an empty frame.
2. **Context beats inference.** If the system can supply the object identity, never guess it from the image.
3. **Unknown → degrade, don't refuse.** Take the generic branch, state that no specific binding was found, and add one data-governance suggestion.

**A fallback branch is not "I don't know" — it is "degraded handling, stated explicitly".**

## Three-tier memory

| Tier | Holds | Lifetime |
|---|---|---|
| Short-term | State sequence within one analysis | Single analysis |
| Conversational | Last 5–10 turns of referential context | Single session |
| Long-term | Profiles and summaries persisted per scope | Across days |

- **Short-term is never persisted** — it is reasoning state, not data
- **Conversational keeps references, not conclusions** — a stale conclusion is worse than a lost one
- **Long-term must carry a scope key** — cross-scope reads are a security incident, not a bug

## Dual register

| Register | Context | Traits |
|---|---|---|
| **A Serious** | Alerts, tickets, reports | Objective, direct causality, concrete verbs |
| **B Approachable** | Chat, explainers, non-urgent nudges | Conversational, tactful, lightly humorous |

**Translate terms, never facts.**

> ❌ Diel vertical migration explains the absence of surface individuals at noon
> ✅ It keeps a schedule like we do — hides deep when the sun is harsh, comes up morning and evening

**Red line**: register B may not introduce new inferences, alter quantities, or soften a risk level. Humour may only affect phrasing.

**Switch on the medium, not the tone**; high-risk events use register A regardless of medium.

## Follow-up prompts

After answering, offer 2–3 most-likely next steps.

A good follow-up: answerable from data already in hand / a natural next move / points at a valuable action.

**Never more than 3 — beyond that it is a menu, not a suggestion.**

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original. Extracted from an aquaculture assistant's router skill — **all business branches removed, only the orchestration skeleton kept**.
