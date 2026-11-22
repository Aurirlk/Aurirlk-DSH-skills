# git-submit-safety

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Three jobs: **what you commit is exactly what you changed; when you say it's pushed, it really is; and the user can run it the moment you hand it over.**

For commit *messages*, see [git-commit-message-generator](../git-commit-message-generator/README.en.md). This skill is about **which files move, how to verify they arrived, and what to hand over afterwards**.

## When to use

- "Commit and push this for me"
- You pushed but aren't sure it landed
- Pre-commit keeps failing (the classic `fmt` + `git diff --exit-code` loop)
- Two agents or two people share one worktree
- Files "disappeared" / `.git` looks damaged
- **You pulled, hit Run, and the IDE says `cannot find symbol`**

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

## Pushing is not the finish line

The most-skipped section — and the one users care about most.

After a push, most people hit **Run** immediately. Report only a few SHAs and they walk into a confusing error:

```
java: 找不到符号        (cannot find symbol)
```

…for a symbol sitting in the very next file.

**The source isn't broken — the incremental compile scope shrank to a single file.** After a pull or fast-forward, the IDE marks only timestamp-changed files dirty and compiles just those; sibling classes in the same package are neither in the compile unit nor on the classpath.

So every handover needs its own pre-build checklist:

1. New or changed DTOs, constants, module dependencies → **Reload All Maven Projects**
2. Anything pulled → **Rebuild Project**; never right-click a single file → Compile
3. Annotation processors (Lombok / MapStruct) enabled?
4. Schema changes this round → ran on TEST? pending on PROD? **DDL must land before the new build**
5. Rebuild artifacts / restart needed? **Never `mvn compile` while the service is running**
6. Local entry point, profile, and health-check before firing requests

> Real incident: a fast-forward brought in one commit; a DTO's timestamp changed (the content only lost a blank line), the IDE compiled that one file, two sibling classes weren't in the compile unit, and the service wouldn't start. An offline repro proved the source was fine — it was the compile scope.

## Diverged remote: fast-forward only

When `push` is rejected, prefer `merge --ff-only`. **Don't default to rebase** — it rewrites shared history, and recovery depends on reflog.

Save `status --untracked-files=all` before and after the fast-forward and `diff` them; only continue once it prints "working tree intact." That step once saved 66 uncommitted changes.

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
