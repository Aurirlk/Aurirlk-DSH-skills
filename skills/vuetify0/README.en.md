# vuetify0

> Part of the [Aurirlk DSH Skills](../../README.md) collection · [← back to the index](../../README.md)

**English** | [中文](README.md)

A guide to using and authoring with [`@vuetify/v0`](https://0.vuetifyjs.com/) — the **headless
logic layer for Vue 3**. Components carry behaviour and no styling, so they drop into any design
system.

## When to use

**Before writing custom logic, check whether v0 already provides it.** That lookup table is the
core value of this skill:

| You need | Use |
|---|---|
| Single selection | `createSingle` |
| Multi selection | `createSelection` |
| Selection with "select all" | `createGroup` |
| Step wizard / carousel | `createStep` |
| Form validation | `createForm` |
| Cross-layer state | `createContext` |
| Browser / DOM utilities | v0 utilities |

**Pay attention to the "do not roll your own" cases**: native `<button>`, homemade `setTimeout`
timers, homemade overlays and dialogs — those are `Button`, `useTimer` and
`Dialog`/`Popover`/`useStack`.

## Bundled references (loaded on demand)

```
references/
├── REFERENCE.md             full API reference
├── selection-patterns.md    single / multi / group / step selection
├── component-examples.md    component usage examples
├── anti-patterns.md         anti-patterns
├── layer-decisions.md       layering decisions
└── authoring-guide.md       authoring your own v0 components
```

## Installation

```bash
pnpm add @vuetify/v0
```

No global plugin required — import only what you need:

```ts
import { createSelection } from '@vuetify/v0/composables'
import { Tabs } from '@vuetify/v0/components'
```

## Source & license

**Taken from the official skill**: `skills/vuetify0/` in
[`vuetifyjs/0`](https://github.com/vuetifyjs/0) (MIT License, Copyright © 2016-now Vuetify, LLC).

Changes made here: frontmatter adapted for DSH (bilingual `description`, added `whenToUse`) and
this README written. The body and `references/` are the official originals — **this copy is more
complete than the one in DataAgent**, which was a 3.9 KB abridged version that had lost all of its
references.

Official docs: <https://0.vuetifyjs.com/> · official skill page: <https://agentskills.so/skills/vuetifyjs-0-vuetify0>