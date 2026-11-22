# git-submit-safety

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

One job: **what you commit is exactly what you changed — and when you say it's pushed, it really is.**

For commit *messages*, see [git-commit-message-generator](../git-commit-message-generator/README.en.md). This skill is about **which files move, and how to verify they arrived**.

## When to use

- "Commit and push this for me"
- You pushed but aren't sure it landed
- Pre-commit keeps failing (the classic `fmt` + `git diff --exit-code` loop)
- Two agents or two people share one worktree
- Files "disappeared" / `.git` looks damaged

## Four rules

1. **Never `git add -A`, `git add .`, or `git commit -a`.** Parallel edits, temp files and build artifacts get swept in wholesale.
2. **Run `git status --short -uall` before every `add`.** It tells you whose changes you're looking at.
3. **Trust `git ls-remote`, not the local `[origin/dev]` marker.** The tracking ref lies when it's stale.
4. **`cp -r .git` before touching it.** Recovery order: `reflog` → `fetch` → `update-ref` → `reset`.

## The step everyone skips

`git add <tracked-dir>` **does not pick up untracked new files**.

So "I committed five files" is often four. The only way to catch it before pushing:

```bash
git show --name-only --format= HEAD
```

## ⚠️ Risk notice

The skill never edits or deletes your code, but it does run `git add` / `commit` / `push`, which change repository state.

- Confirm the target branch before pushing (don't ship a test commit to `main`)
- Any `push --force` or `reset --hard` must be explained and confirmed first

## Usage

```
Commit this — no add -A, split into two logical commits.
```

```
I just pushed. Verify the remote actually has it.
```

Full command sequence and the misdiagnosis table are in [SKILL.md](SKILL.md).

## Boundaries

- Covers commit + push only. Merging, conflict resolution, rebase strategy and PR flow are out of scope.
- Assumes ordinary git semantics; LFS and submodules only get generic advice.
- Commit discipline is a team convention, not something git enforces — both the human and the agent have to hold it.
