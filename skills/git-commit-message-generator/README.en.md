# git-commit-message-generator

> Part of the [Aurirlk DSH Skills](../../README.md) collection · [← back to the index](../../README.md)

**English** | [中文](README.md)

Generates [Conventional Commits](https://www.conventionalcommits.org/) messages, with the emphasis
on writing a **subject that actually says something** — no "updated stuff" filler.

## When to use

When the user asks you to write, review or fix a git commit message.

## The type set

Pick exactly one — if none fits, ask the user or infer from context:

| Type | For |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation |
| `style` | Formatting only (no behaviour change) |
| `refactor` | Refactoring (no external behaviour change) |
| `test` | Tests |
| `chore` | Build tooling or auxiliary changes |

## Writing the subject

- Concise and **concrete**; avoid vague verbs like "did / changed / updated"
- 12–30 characters
- By default output a single line `type:subject`, with no body

```
feat:complete the chat page
fix:stop SSE scroll from failing to stick to bottom
refactor:rework timeline rendering for streaming reports
docs:document the ECharts rendering setup
chore:adjust lint/format script config
```

## Installation

See the [installation section of the repository README](../../README.en.md#installation).

## Source & license

Adapted from `data-agent-frontend-nuxt/.cursor/skills/git-commit-message-generator` in
[Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent)
(Apache License 2.0, original author [SmileSnow819](https://github.com/SmileSnow819), PR #485).

Changes made here: frontmatter adapted for DSH, this README written. The body is unchanged.
See [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md).