# disk-butler · Windows Computer Butler

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← back to the index](../../README.en.md)

> A Windows computer butler for AI agents, with two tracks:
> **① Query** (read-only): answers "what's installed / where did my space go / is this safe to
> delete / what's actually inside this 55 GB folder / when did it start growing"
> **② Operate** (has side effects): clean junk by safety tier → migrate caches transparently with
> NTFS junctions → keep a durable record
>
> Ships as a DSH plugin (`dsh.bundle.patch`) and as a plain agent skill (`SKILL.md`).

**English** | [中文](README.md)

---

> ## ⚠️ This tool permanently deletes files
>
> `Invoke-Cleanup.ps1` **really deletes files once you add `-Execute`, and they do not go to the
> Recycle Bin.** Read the safety model below before using it.
>
> **What it does to protect you** (design, not a guarantee):
> - The scanner **never deletes** — it only produces a plan
> - The executor **defaults to a dry run**; without `-Execute` nothing happens
> - Every item is re-validated right before deletion: environment-variable anchors, backup
>   subdirectories, processes holding files, administrator requirement
> - When unsure, `-Quarantine` moves things into a per-volume quarantine so you can put them back
>
> **What it cannot decide for you**: whether a directory matters to your work. A machine cannot
> tell that "the user considers this important" — so confirm before any deletion.
>
> The author is not responsible for data loss. **Try it on a throwaway directory first.**

---

## What problem it solves

Asked to "free up space on C:", an agent that just scans the disk tends to do two things wrong:
**deleting the wrong thing**, and **having to scan everything again next time**.

How disk-butler avoids both:

1. **The scanner never deletes** — it emits a plan annotated with a safety tier
2. **The executor defaults to a dry run**; it requires an explicit `-Execute`, and re-validates the
   safety rules at execution time (defence in depth)
3. **Ambiguous items can be quarantined first** — `-Quarantine` moves them to a same-volume
   quarantine you can restore from
4. **Cache migration uses NTFS junctions**, fully transparent to the application, with a rollback
   record
5. **Conclusions are archived** into a local machine wiki, so the next session reads instead of
   re-scanning

## One script per job

| Script | What it does | Side effects |
|---|---|---|
| `Find-Junk.ps1` | Scans 10 categories of junk, emits a plan with a safety tier per item | None (read-only) |
| `Invoke-Cleanup.ps1` | Executes a plan; also manages the quarantine (list / restore / purge) | Yes |
| `Move-Cache.ps1` | Migrates a cache directory via NTFS junction, with rollback | Yes |
| `Get-Drilldown.ps1` | Drills down level by level: "what is actually inside this folder" | None (read-only) |
| `Get-Trend.ps1` | Turns accumulated snapshots into a space trend and a movers leaderboard | None (read-only) |
| `Update-Wiki.ps1` | Generates / refreshes the local machine wiki (and recomputes the trend page) | Yes (writes files) |
| `Test-SkillHealth.ps1` | Skill self-check (31 checks) | None |

## Measured results (on one real development machine)

| Category | Space identified |
|---|---|
| Browser caches (Chrome / Edge `Cache`, `Code Cache`, `CacheStorage`) | 5.06 GB |
| Files in `%TEMP%` older than 7 days | 977 MB |
| `~/.cache/<tool>` | 589 MB |
| Package manager caches (uv / npm / pip / Maven) | 394 MB |
| **Agent script residue** (npx cache, `.codex\.tmp`, session artefacts) | 223 MB |
| Crash dumps | 150 MB |
| **Total** | **~7.4 GB** |

A drill-down example: `C:\Users` is actually **57.52 GB** (500k files / 82k directories), of which
**`AppData` accounts for 45.96 GB (79.9 %)** — an answer you cannot get from top-level directories
alone; it needs two levels of drilling.

## Quick start

```powershell
# 1) Scan (read-only, deletes nothing)
.\skills\disk-butler\scripts\Find-Junk.ps1 -Days 7 -JsonOut "$env:TEMP\junk-plan.json"

# 2) Dry-run the cleanup (this is the default)
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan "$env:TEMP\junk-plan.json"

# 3) Clean only the safe tier
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan "$env:TEMP\junk-plan.json" -Execute -Safety Safe

# 3b) More conservative: quarantine first, purge after a few days
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan "$env:TEMP\junk-plan.json" -Execute -Safety Safe -Quarantine
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -ListQuarantine
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -PurgeQuarantine -OlderThanDays 7
```

Answering "what is actually inside this folder":

```powershell
.\skills\disk-butler\scripts\Get-Drilldown.ps1 -Path 'C:\Users' -Top 8 -Depth 3 -MinSizeMB 100 -WithCount
```

Migrating a cache that is hard-coded to C::

```powershell
.\skills\disk-butler\scripts\Move-Cache.ps1 -Source "$env:USERPROFILE\.cache\puppeteer" -Destination "E:\Cache\puppeteer"
.\skills\disk-butler\scripts\Move-Cache.ps1 -List                       # show migrations
.\skills\disk-butler\scripts\Move-Cache.ps1 -Rollback -Manifest <记录>   # roll back
```

Reading the space trend:

```powershell
.\skills\disk-butler\scripts\Get-Trend.ps1 -WikiRoot "$env:DISK_BUTLER_WIKI"
```

## Safety model

**Two-layer validation**: the safety rules are checked both when scanning (`Add-Item`) and when
executing (`Invoke-Cleanup`).

| Rule | Behaviour |
|---|---|
| Target is an environment-variable anchor **and** the mode is whole-directory deletion | **Refused** |
| Target is an environment-variable anchor **and** the mode is age-based cleanup | Allowed, but the safety tier is forced down to `Confirm` |
| Target contains a `backup` / `recover` / `restore` subdirectory | **Refused** unless `-Force` |
| Administrator rights required but not held | Skipped with a message |
| Migration verification finds a file-count or byte-count mismatch | **Aborts without touching the source** |

The point of doing it twice: **a stale or tampered plan still cannot delete an environment-variable
anchor**, because execution re-checks. This was tested — a forged plan aimed at `~/.codex`
(which holds login credentials) was rejected at execution time.

## Installation

### Option 1 — install the whole collection (recommended)

Add the collection repository as a dependency of your DSH profile to register **every skill at once**:

```powershell
# your profile directory may not be called `desktop`; use whatever you have
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

```bash
# macOS / Linux
cd ~/.dsh/profiles/desktop
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

> This repository is **not published to the npm registry**, so `pnpm add dsh-aurirlk-skills`
> will fail today. Use the git form above — the contents are identical.
> Update with `pnpm update dsh-aurirlk-skills`.

### Option 2 — link just this skill

```powershell
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\disk-butler" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\disk-butler"
```

```bash
# macOS / Linux
ln -s ~/dev/Aurirlk-DSH-skills/skills/disk-butler ~/.dsh/skills/disk-butler
```

### Option 3 — other agents

The skill body is `SKILL.md` and does not depend on DSH. Claude Code, Codex and any other agent
that understands `SKILL.md` can use this directory directly.

### Verifying the install

```powershell
# Just ask the agent: "where did my C: space go" — it should load this skill.
# Or run the self-check by hand:
& "$env:USERPROFILE\.dsh\skills\disk-butler\scripts\Test-SkillHealth.ps1" -Deep
```

## Repository layout

```
Aurirlk-DSH-skills/            ← the collection repo (index.js / package.json live at the root)
└── skills/disk-butler/        ← this skill's body (single source of truth for all three packages)
    ├── README.md / README.en.md   intro / usage / installation
    ├── SKILL.md                   the skill body (what the agent reads)
    ├── scripts/                   7 scripts
    └── references/                docs loaded on demand
```

## Maintenance

> The commands below assume the **repository root** as the working directory.

```powershell
.\scripts\Fix-Bom.ps1                                    # 0. fix BOM first
node scripts\self-test.mjs                               # 1. collection registration + parser tests
.\skills\disk-butler\scripts\Test-SkillHealth.ps1 -Deep   # 2. this skill's 31 checks
```

**Step 0 is not optional and cannot be left to memory.** Editing tools strip the UTF-8 BOM, and the
runtime is Windows PowerShell 5.1 — which reads BOM-less UTF-8 as GBK, garbling Chinese and
**failing to parse the script**. This bit us three times during development, so it is now a command.

All scripts target **Windows PowerShell 5.1** (not PowerShell 7), which explains most of the traps
documented in [`references/维护与踩坑.md`](references/维护与踩坑.md) (12 real ones, Chinese).

## Known limitations

- **Windows only.** Depends on `robocopy`, NTFS junctions, PowerShell and a set of Windows path
  conventions. Linux / macOS would need a separate implementation, not a branch.
- Targets that need administrator rights (`C:\Windows\Temp`,
  `SoftwareDistribution\Download`, shadow copies) are flagged and skipped.
- **A gap between "used space" and "sum of directory sizes" is normal.** It usually comes from the
  protected `System Volume Information` (restore points / shadow copies), which enumerates as 0 B
  without elevation.
- **The instruction body is currently in Chinese.** The frontmatter `description` is bilingual so the
  skill is discoverable in both languages; an English body is welcome as a contribution.

## Credits

- The plugin entry follows the approach used by
  [`dsh-plugin-guide`](https://github.com/PerryLink/dsh-plugin-guide) (registering a skill via
  `ctx.skills.register()` with a directory `resourceBase`). **The implementation here is an
  independent rewrite** — which incidentally fixed a frontmatter-parsing failure on **CRLF** line
  endings, and added unit tests for it.
- The **"agent script residue"** category was discovered by measuring a real machine, not imagined:
  `_npx` held package copies left behind by `npx -y`, and `.codex\.tmp` held 94 MB.
- The safety rules that prevent bad deletions (backup subdirectories, environment-variable anchors)
  come from real near-misses, documented in [`references/维护与踩坑.md`](references/维护与踩坑.md).

## License

MIT
