# git-repo-divergence-check

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Decide whether two repos share a baseline, then pick the right move: merge, cherry-pick, or replay by path. No file contents are downloaded — only commits and blob SHA-1s.

## When to use

- "We moved to a new repo, here's the URL" — check the baseline first
- You have a patch that needs to land in another repo
- Two local directories share a name and you don't know which is canonical
- You want to know whether a whole feature directory exists in the target repo

## Three steps

1. **Blobless clone**: `git clone --filter=blob:none --no-checkout` — commits and trees only, fast even on huge repos.
2. **Test ancestry**: take a commit SHA from A and run `cat-file -e` in B. Present → merge/rebase is valid. Absent → history is unrelated, replay by path only.
3. **Quantify drift**: `git ls-tree -r` gives every file's blob SHA; set operations in Python tell you same-path-identical, same-path-different, A-only and B-only.

Key threshold: **if more than ~50% of shared paths differ, don't apply old patches** — the context will not match.

## Pure additions move with zero conflicts

For paths the target doesn't have, generate a `new file` patch against git's empty tree, preview with `apply --stat`, then apply. A path that doesn't exist has no context to conflict with.

Full commands, the interpretation table, and six hard-won gotchas are in [SKILL.md](SKILL.md).

## ⚠️ Easy mistake

With two same-named directories, **don't guess the canonical one by file count**. Run step 2 first, then decide which to back up and which to keep. A matching directory name does not imply a matching baseline, and the smaller tree is not necessarily the stale fork.

## Usage

```
We switched to a new repo at <url>. Check whether it shares history with my branch.
```

```
Two directories have the same name. Which is canonical? Don't overwrite anything.
```

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

See the [collection index](../../README.en.md#installing-a-single-skill) to install only this one.

## Boundaries

- Measures content drift and commit ancestry, not semantic compatibility.
- Empty-tree patches cover pure additions only; overlapping changes still need manual alignment.
- Authentication setup is out of scope.
