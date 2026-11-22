# no-stub-delivery

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Three things look like working features until you touch them:

| Form | Looks like | Actually |
|---|---|---|
| **Fake data** | Tables have rows, charts have curves | Hardcoded / randomly generated |
| **Fake implementation** | Class, interface, config all present | `return null` / `TODO` / placeholder |
| **Fake completion** | Docs say "integrated" | No code, or code nobody calls |

Their shared property: **they look done without solving anything** — and they all survive a demo. That's precisely why they persist.

## When to use

- Pre-delivery self-check, acceptance list, go-live review
- A user says "this doesn't work" or "this data is fake, right?"
- Taking over code and needing to know which features are real
- Writing a status report and unsure what may be checked off

## The core stance

> **Lying to make it look right is the most expensive kind of shortcut.**

Once you're judged to be faking it, every later claim gets discounted. So when there's no data, **build the real path** — don't invent data.

```
Bad:  seed a few mock rows so the dropdown has options
Good: add a "upload a local file" entry that reuses the real upload API

Bad:  fabricate a result to display
Good: show "no data" and explain how to produce some
```

## Most useful output: four states

Not binary done/not-done:

| State | Meaning |
|---|---|
| ✅ Verified | Real path exercised, evidence attached |
| 🟠 Implemented, unverified | Code exists and is called, but no end-to-end run |
| 🔴 Not implemented | Interface only / empty body |
| ⚪ N/A | Evaluated and deliberately skipped |

**The second state is what makes this honest.** It gives "I'm not lying, but I won't check the box either" a legitimate place to exist. Without it, people are forced to choose between lying and admitting they did nothing.

## Fast heuristics

- **Fake data**: ask "who wrote this row?" — no answer, it's fake
- **Skeleton migrated, never wired**: grep the symbol repo-wide; zero callers = not connected
- **Wired but no source**: walk the path from the user's action and find where each parameter is first written
- **Fake completion**: three evidences — code exists (weak) / has callers / actually ran (strong); all three or no check mark

## ⚠️ Boundaries

- An **audit and reporting** skill; it won't implement the missing feature for you
- The four states only matter if actually used — decorative labels are worse than none
- Sometimes "we didn't build this" takes more courage than a vague "done" — that's the point

## Usage

```
Audit this delivery for truthfulness. Don't let fake data slide.
```

```
The doc says MinIO is integrated. Verify that against the code.
```
