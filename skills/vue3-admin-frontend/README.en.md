# vue3-admin-frontend

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Build admin pages the way the skeleton already does.

## What this fixes

A backend field changes, and the frontend has to follow. Not hard work — but **miss one spot and it either won't compile, or it compiles and the UI shows a raw i18n key**.

The spots people miss: the type definitions, **every** locale file, the **hand-written `I18n.Schema` interface in `app.d.ts`**, and re-running route generation.

This skill lays out "the seven places to touch when a DTO changes" in a fixed order, and bakes in the conventions you otherwise have to remember.

## Follow the skeleton, don't invent a style

The skeleton is the SoybeanAdmin family: `@sa/axios` flat requests, `@elegant-router` file routing, `useTable` / `useTableOperate`, Naive UI + UnoCSS.

You may find `useTable` less flexible than a composable of your own. But if forty pages in the repo are written this way, **page forty-one should match** — that's what makes future changes linear instead of one-off. Anything marked "convention" in the skill is not up for a personal-preference override.

## Three failures that actually happened

**1. An i18n key lives in two *kinds* of place — and there's more than one locale file**

`src/locales/langs/*.ts` holds the *values* — **one file per language**. Overseas products commonly run eight (zh-CN, zh-TW, en, vi, th, id, ms, fil); miss one and that language renders the raw key.

The `I18n.Schema` interface in `src/typings/app.d.ts` holds the *type* — and that interface is **hand-written, never generated** (some projects also have `extra.d.ts`).

Add the value without the type: it works at runtime, but `vue-tsc` reports "property does not exist" everywhere the key is used. Delete the value but keep the type: it compiles fine, and the UI renders the raw key string.

**2. `prose` classes do not exist in this skeleton**

UnoCSS ships without the typography preset, so `prose` and `prose-sm` are no-ops. Markdown styling has to go through the project's named `markdown-content.vue`. When "the style didn't apply," suspect the class isn't defined before you suspect the build.

**3. Table `columns` must be a function**

Written as a plain array, the table renders — but columns stop reacting to state. The correct form is `columns: () => [...]`.

## It can also examine itself (no dev server)

The skill ships a **zero-dependency, single-file** checker. It reads source; it does not start a dev server or run `vue-tsc`:

```bash
node scripts/Test-FrontendHealth.mjs .            # from the project root
node scripts/Test-FrontendHealth.mjs . --strict   # in CI: warnings also fail
```

Three checks, all of the "we agreed to check this, and humans will definitely miss it" kind:

| Check | Catches | Consequence if missed |
| --- | --- | --- |
| `columns` | `useTable({ columns: [...] })` written as an array | Table renders, but columns stop reacting to state |
| `i18n` | Key in the locale files but not in `I18n.Schema` (or the reverse), or a key missing from some locales | `vue-tsc` fails at every usage site, or the UI quietly shows the raw key |
| `props` | A `defineProps` member nobody passes, or a component nobody references | Dead props and orphaned components mislead the next reader |

Findings are graded `error` / `warn` / `info`, each with `file:line`; `--json` for machines.
**"Clean" and "not looked at" stay distinguishable** — anything it cannot decide (`v-bind` spreads,
`Pick`/`Omit`, external types, `Record<>`) is listed under "degraded / skipped" instead of being
counted as a pass.

The checker has its own tests (`scripts/Test-FrontendHealth.selftest.mjs`) with two fixtures:
one where everything must be reported, one full of traps where nothing may be reported.
A checker that always prints ✓ is worse than no checker.

## The seven steps, in order

```
read the backend diff → API layer → types → pages → i18n → regenerate routes → typecheck + lint
```

Do pages before types and `vue-tsc` dumps a dozen "property does not exist" errors at once, burying the real one.

## When you'll reach for it

- The backend shipped an endpoint; the frontend needs to consume it.
- Adding an admin page (list + drawer form).
- `vue-tsc` complains about an i18n key type.
- A utility class on the page does nothing.
- You changed a route and a refresh throws you back to the default page.

## Install

```bash
pnpm add github:Aurirlk/Aurirlk-DSH-skills
# or just this one
ln -s "$PWD/skills/vue3-admin-frontend" ~/.dsh/skills/vue3-admin-frontend
```

## What it leaves alone

- The backend's API design — this side only consumes it.
- Build config, deployment, CI pipelines.
- Pixel fidelity to a design file — this is about structure and convention.

## See also

- [agent-chat-endpoint](../agent-chat-endpoint/README.en.md) — the other half of streaming chat (the `reader.cancel()` trap)
- [git-submit-safety](../git-submit-safety/README.en.md) — the frontend pre-commit hook runs `pnpm fmt`, reorders files, and then fails its own `git diff --exit-code`
