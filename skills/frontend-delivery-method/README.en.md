# frontend-delivery-method

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Frontend delivery method: from "the backend gave me an endpoint" to "users can actually use it."

## What this fixes

> **The biggest waste in frontend work isn't slow coding — it's debugging the wrong layer.**

A real one: the user reported "login fails." First instinct was the frontend login logic. Two hours later the answer — three different admin consoles were running on that machine, each pointed at a different backend; one backend was returning 502 upstream, another wasn't running at all. **Not a single line of frontend code was wrong.**

This skill doesn't teach Vue syntax (that's [vue3-admin-frontend](../vue3-admin-frontend/README.en.md)). It's about **sequence and judgment**:

- What you must nail down before writing code, or you'll pay for it in rework
- "Environment works" has three levels — L1 isn't usable
- When symptom X appears, **which layer to check first**
- What order to change things so you don't drown in errors

## Seven threads

**1. Three questions before starting** — Which machine is the backend on (gateway / environment / path prefix)? Is the contract final? Which states must the page cover (empty / loading / error / extreme / recovery)? Writing only the happy path is the classic beginner mistake.

**2. Three levels of "it runs"** — `dev` starts (L1) ≠ you can log in (L2) ≠ you get real data (L3). Three probes: `curl` the endpoint directly, check devtools for where the request actually goes, compare `base_url` against the proxy prefix. The third is the sneakiest: a prefix mismatch shows up as a browser 404 while you're reading backend logs.

**3. Config without touching tracked files** — To point local config at your own machine without affecting colleagues, **don't** `git rm --cached .env` (that creates a deletion commit and removes the file from everyone). Use `.env.<mode>.local`: highest Vite priority, `*.local` is already gitignored, zero commits, zero impact.

**4. Pin your dependencies** — The risk isn't an old version, it's a **transitive dependency silently upgrading to a release that changed `exports`**. Real shape: a library declares `^2.7.34`, 2.23.0 gets installed, the new version dropped a subpath, and Vite's pre-bundling fails outright. Diagnose in three steps: declared range → installed version → does that version still export the subpath.

**5. Contract order** — DTO → types → API functions → pages → i18n → routes → verify. Reverse it and `vue-tsc` dumps a dozen errors, burying the real one.

**6. Decide who scrolls before styling** — When the input box gets pushed out of the viewport, the cause is almost always **a broken height chain**. Don't just add `min-h-0` (useless when the break is above the page), compute height from the viewport not the parent (parent feedback loops), and remember `overscroll-behavior: contain` cuts the scroll chain into a dead zone.

**7. Verification means actually looking** — `typecheck` / `lint` / `build` can all pass and the page can still be wrong. Those three only prove the code is legal.

## Three failures that actually happened

**Streaming freezes for seconds, then everything appears at once**

Not the network. `s.msgs.push(reply)` pushes the **raw object**; `reply.text += chunk` afterwards mutates something that isn't the proxy, so nothing re-renders — until some real ref changes and the whole thing repaints. One-line fix: after push, take `const r = s.msgs[s.msgs.length - 1]` and mutate the proxy.

**Markdown renders only half of itself**

The backend filtered deltas with `isBlank()`, dropping the frames that contained only `"\n"` → the accumulated text had no line breaks at all → heading, table and rule syntax all broke, leaving only inline bold alive. `isEmpty()` (null/empty only) and `isBlank()` (whitespace counts) are two different things.

**One key added, and some language shows the raw key string**

There are **eight locale bundles** (zh-CN, zh-TW, en, vi, th, id, ms, fil), not two. And the `I18n.Schema` type table is a **hand-written interface**, never generated.
The trap is how you search: `grep "中文串"` only hits zh-CN — the same key sits in seven other files under other languages. **Search by key name, never by value.**

## Two more sections worth reading

- **Splitting a giant component**: one file hit 6229 lines. The order is "stateless presentational → data hook → state machine," lowest risk first, no skipping. Fix the state model before splitting, or every extracted component will be missing states.
- **The frontend-specific fake completion**: a prop nobody ever passes (badge always 0), a wrapped API function nobody calls, an event callback never wired (reasoning content silently dropped), a button without `@click`, a placeholder pointing at a feature that doesn't exist. **All of these pass typecheck and lint.**

## When you'll reach for it

- Starting a new page or project and unsure where to begin
- `dev` starts but you can't log in, or the list is always empty
- Layout gets stretched and the input box leaves the viewport
- You changed code and the page shows nothing new
- A `.vue` file grew to thousands of lines and you're afraid to touch it
- Before delivery, confirming it's actually done

## Install

```bash
pnpm add github:Aurirlk/Aurirlk-DSH-skills
# or just this one
ln -s "$PWD/skills/frontend-delivery-method" ~/.dsh/skills/frontend-delivery-method
```

## Division of labour with vue3-admin-frontend

| | Covers |
|---|---|
| **frontend-delivery-method** (this one) | Process: sequence, judgment, triage tree, delivery checklist |
| [vue3-admin-frontend](../vue3-admin-frontend/README.en.md) | Code: stack, naming, `useTable`, flat requests, drawer forms |

Read this one for direction, that one for the code to copy.

## What it leaves alone

- Framework syntax (the process applies to Vue and React alike).
- Design fidelity and visual detail.
- CI and deployment pipeline configuration.
