# db-change-report

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Schema changes are not code changes. A bad commit can be re-pushed; **a bad migration is usually only recoverable from a backup**.

This skill governs the sentence that most often gets hand-waved in a delivery: "oh, and I changed a table."

## What it demands

Any database change — DDL, data `UPDATE`, backup table, or a script someone else must run — needs its **own clearly separated section** with five answers:

| # | Required |
|---|---|
| 1 | Script file name + type (DDL / UPDATE / backup table) |
| 2 | Was TEST executed? With evidence. |
| 3 | PROD execution list **in order** |
| 4 | Does it require a restart / jar rebuild? |
| 5 | Backup and rollback method |

## Order is not a detail

The direction flips depending on the change:

- **Add** a column / table → schema first, code second
- **Drop** a column / change semantics → code first, schema second (old bytecode reads the dropped column and crashes on boot)

And "we have a backup" is **not** a rollback plan. Say which table, which column, which condition.

## Three habits it adds

1. **Idempotent by default** — `IF NOT EXISTS`, information_schema guards, a single readable sentinel condition; re-running affects 0 rows
2. **Use the history table instead of `*_bak_*`** — write the before-state, backfill the after-state, rollback = reverse UPDATE
3. **Evidence, not adjectives** — `SHOW CREATE TABLE` diff, MD5 of key fields, 0 rows on re-run

## ⚠️ Risk notice

This skill guides an agent through **executing database changes** — high risk by nature.

- No direct production writes from a developer laptop unless explicitly authorized, per session
- `KILL` / `DROP` / `TRUNCATE` require separate confirmation, never bundled into a "cleanup"
- No production write without a usable rollback path

## Usage

```
I'm adding two columns — write the full change report.
```

```
This script has to run in production. Check idempotency and rollback.
```

Template and SQL patterns are in [SKILL.md](SKILL.md).

## Boundaries

- Covers **expression and safety** of the change, not whether the business should change
- Idempotent patterns are MySQL-8 oriented; other engines are outlined, not exhaustively covered
- Execution still belongs to someone with credentials — an agent should not hold production secrets
