# code-review-refactor

> Part of the [Aurirlk DSH Skills](../../README.md) collection · [← back to the index](../../README.md)

**English** | [中文](README.md)

**Actionable** code review and refactoring for Nuxt 4 + Vue 3 + Vuetify 3 — not "this could be
nicer", but *extract it here, the signature looks like this, here is how to verify nothing broke*.

## When to use

- The user says the code is messy / asks for a review / wants a refactor
- A component or page is bloated (past 500 lines and still growing)
- **Duplicated CSS**: the same `markdown-body`, card spacing or button styles across components
- **Near-identical pages** that differ only in their buttons and column definitions
- You catch yourself about to reinvent something that already exists — **extract it first**

## What it produces

A fixed four-part structure, in order:

1. `## 最关键问题（按严重度从高到低）` — one line per issue + its impact (rendering / performance / maintainability / correctness)
2. `## 重构/复用建议（可落地）` — extraction target (`utils` / `composables` / `services` / component / CSS), why, expected payoff
3. `## JSON 驱动复用方案` — if duplicated pages exist, a minimal config schema plus an example
4. `## 验证与回归（Test Plan）` — the shortest manual verification checklist that still proves no regression

## Core principles

| Principle | Meaning |
|---|---|
| **Behaviour first** | Structure only. **Never change existing functionality, interfaces or interaction semantics.** |
| **Small, verifiable steps** | Extract first, replace second — avoid one huge change that is hard to debug |
| **Extract before duplicating** | Pure functions → `utils`; lifecycle/state-coupled logic → `composables`; requests and data mapping → `services` |
| **Componentize** | Repeated UI structures → shared components; similar pages → config/JSON driven, **not copy-pasted** |

**Allowed**: extracting shared logic, splitting sub-components, merging CSS, adding necessary wrappers.
**Forbidden**: changing interaction semantics or data structures just to look prettier; sweeping rewrites.

## Installation

See the [installation section of the repository README](../../README.en.md#installation).
This skill has no script dependencies — installing it is enough.

## Source & license

Adapted from `data-agent-frontend-nuxt/.cursor/skills/code-review-refactor` in
[Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent)
(Apache License 2.0, original author [SmileSnow819](https://github.com/SmileSnow819), PR #485).

Changes made here: frontmatter adapted for DSH (`name` aligned with the directory, bilingual
`description`, added `whenToUse`), this README written. The body is unchanged.
See [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md).