# agent-tool-safety

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Give an agent a read-only tool and the worst case is "no data found".
Give it a **write** tool and the worst case is it apologizing while production changes underneath you.

This skill is about **designing tools so the model can't mislead the user — or itself**.

## When to use

- Adding a tool that mutates something (prompts, config, agents, scripts)
- Designing an "AI proposes → human confirms → commit" flow
- Adding a master switch, read-only mode, or sandbox isolation
- Debugging these:
  - Model says "updated" but only a draft was written
  - Editing agent A changed agent B
  - The switch is off but the model still calls the tool
  - Sandbox scripts exit 127, or all Chinese text renders as boxes

## Six hard rules

1. **Name write tools `draft_*`.** Named `update_*`, the model *will* claim it's done.
2. **Draft ≠ pending ≠ applied.** Separate tables, explicit state machines; drafts must not appear in approval queues.
3. **Changes carry a `scope`.** Two auto-increment sequences collide; validate on draft, query, and apply.
4. **`apply` writes only targeted columns.** Flip status first, then row-by-row; whole-row writes revert the status.
5. **Put the switch in the assembly layer.** Off = not registered. Framework "explore mode" often doesn't cover custom tools.
6. **Sandbox mounts are read-only; containers never touch the DB.** Run SQL on the host, mount the CSV.

## The counter-intuitive one

> **A framework's "read-only mode" frequently does nothing for custom tools.**

Observed mechanism: the permission engine is typed against a base class, custom implementations bypass it and return `ALLOW`. "I switched it to read-only" is then simply false. The only reliable control is **not registering the tool**.

## ⚠️ Risk notice

This skill guides the design of tools **capable of mutating real data**.

- Every write path needs an explicit human confirmation layer
- Default to `fail-closed`
- Mount `:ro` unless an output directory is genuinely required
- Never let a container connect to production

## Usage

```
I need to give this agent a config-editing tool. Design it with the safety boundaries.
```

```
The model keeps saying "done" without writing anything. How do I fix that?
```

## Boundaries

- About **safety boundaries and state machines**, not one framework's API
- Sandbox examples use Docker; process-level isolation follows the same logic
- Does not decide whether the agent *should* have a capability — only that it can't break things once it does
