# docs-code-sync

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Code changed and docs didn't? Not done.

## What this fixes

A field changed, the API doc still shows the old shape. A config default changed, the config page still says the old value. A feature was removed, the capability list still lists it.

The nasty part is **none of this raises an error**. Code has a compiler; documentation doesn't. So the mistake sits there until some external integrator builds against the doc, integrates, fails, and asks who wrote it — and by then the author has forgotten.

The claim is one line:

> **Code changed without a doc change is unfinished and should not be committed.**

## The mechanism: run the table before you commit

`git diff --name-only`, then walk the "change → doc" mapping table row by row. Endpoints, config keys, schema, modules, capability flags, dependency versions, deploy scripts — every row has a required doc target.

Why a table and not judgment:

- Judgment gives you **consistency where memory happens to work** — endpoints slip (docs aren't the fun part), config gets updated (you remembered that page).
- Deploy scripts are the most-missed row, because whoever edits them never runs them.

## Source-of-truth order: docs come last

```
current source > executable scripts > build config > app config > site config > existing docs
```

On conflict, change the docs. **Never change code to accommodate an old doc.**

Two of those positions are deliberate:

- **Executable scripts outrank build config** — a script gets run; it can't be guessed. A doc that says "initialize with script A" when it's actually B fails the reader on the spot.
- **Existing docs come last** — they're last round's conclusion, possibly built on last round's code.

## The two rules most often broken

**"Don't write plans as capabilities"**

Placeholder implementations, flags that default to off, code that's ready but missing a dependency — all three belong in "current boundaries" with their conditions stated, not in the capability list.

The test is hard: to count as *supported*, a capability needs a matching route, implementation, storage structure, and configuration. Missing one makes it partial.

**"Docs describe the product, not the development process"**

Body text says: what this is, how to use it, who provides each capability, where the edges are.

Migration deltas, remediation logs, incident postmortems, timelines, evidence chains — all of it moves to an archive directory headed with "point in time + superseded by + read-only, not authoritative."

Without this rule the body grows until readers can't tell current state from a temporary condition three months old.

## Then scan for residue

Old names linger in docs, and the cases grep misses are the dangerous ones (casing, hyphens, abbreviations).

```bash
rg "old/path|legacy/dir" docs --glob '!**/node_modules/**'
rg "Java 17|Node 18" docs
rg "removed-page\.md" .
```

Requirement: **every hit is either zero, or sits in a section explicitly marked historical/compatibility.**

## One rule you can't bend

**Never report success you didn't actually run.**

Claiming a build passed when you never ran it is worse than skipping the doc — it tells people it's safe to ship. When the network is down, `--skip-install` and friends are acceptable equivalents, but you must say you substituted.

## When you'll reach for it

- Endpoints, config, or schema changed and you're about to commit.
- Reviewing a doc for "planned" written as "supported."
- A sidebar link 404s.
- Before a handover, confirming docs and code are still the same system.

## Install

```bash
pnpm add github:Aurirlk/Aurirlk-DSH-skills
# or just this one
ln -s "$PWD/skills/docs-code-sync" ~/.dsh/skills/docs-code-sync
```

## What it leaves alone

- The docs framework (VitePress, Docusaurus — same rules apply).
- Layout and styling.
- Writing new prose — that's authoring; this is **verification**.

## See also

- [no-stub-delivery](../no-stub-delivery/README.en.md) — same spirit, other face: don't overstate capability, and doc overstatement is one form
- [db-change-report](../db-change-report/README.en.md) — schema changes need reporting *and* a data-model doc update
- [git-submit-safety](../git-submit-safety/README.en.md) — fold the doc check into the commit routine
