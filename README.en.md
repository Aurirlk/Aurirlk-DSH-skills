# Aurirlk DSH Skills

> **DSH (DeepSeek Harness) skills that I actually use and have verified working.**
>
> One directory per skill, each with its own README covering usage and installation.
> Nothing untested lives here — only skills I have run myself and intend to maintain.

[![verify](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml/badge.svg)](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml)

**English** | [中文](README.md)

---

## Skills

| Skill | What it does | Platform | Docs |
|---|---|---|---|
| **disk-butler** | Windows computer butler: find out where C/D/E space went → clean junk by safety tier → migrate hard-coded caches transparently with NTFS junctions → keep a durable machine archive | Windows | [README](skills/disk-butler/README.en.md) · [中文](skills/disk-butler/README.md) |

<!-- When adding a skill, add a row above and make sure skills/<name>/README.md exists -->

---

## Installation

### Option 1 — install the whole collection (recommended)

This repository is also an npm package. Installing it **registers every skill at once**:

```bash
# from your DSH profile directory
pnpm add dsh-aurirlk-skills
```

Or install it by package name `dsh-aurirlk-skills` from the DSH plugin panel.

### Option 2 — link a single skill

DSH discovers skills by scanning **one level** under a skill root (`<root>/<name>/SKILL.md`),
so you can link just one skill instead of the whole repository:

```powershell
# Windows — a junction needs no administrator rights (a symlink would)
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\disk-butler" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\disk-butler"
```

```bash
# macOS / Linux
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git ~/dev/Aurirlk-DSH-skills
ln -s ~/dev/Aurirlk-DSH-skills/skills/disk-butler ~/.dsh/skills/disk-butler
```

Linking is better than copying: after `git pull` the skill is already up to date.
DSH watches skill roots, so added / renamed / removed skills take effect **without a restart**.

### Option 3 — other agents

The skill body is just `skills/<name>/SKILL.md` and **does not depend on DSH**.
Any agent that understands `SKILL.md` (Claude Code, Codex, …) can use the directory directly.
The repository also ships `.codex-plugin/plugin.json` for the Codex/OpenAI plugin flow.

---

## Repository layout

```
Aurirlk-DSH-skills/
├── README.md / README.en.md   ← you are here (intro + skill index)
├── LICENSE / CONTRIBUTING.md / SECURITY.md / CHANGELOG.md
├── .gitattributes / .editorconfig / .gitignore / .npmignore
├── .github/workflows/verify.yml     ← CI: verifies every skill
├── scripts/Fix-Bom.ps1              ← repo-level dev tool (not published)
├── index.js / cordis.patch.yml / package.json   ← collection package (registers all skills)
├── .codex-plugin/plugin.json        ← Codex/OpenAI plugin manifest
└── skills/
    └── disk-butler/           ← one skill
        ├── README.md / README.en.md   ← intro / usage / installation
        ├── SKILL.md                   ← the skill body (what the agent reads)
        ├── scripts/                   ← executable scripts
        └── references/                ← docs loaded on demand
```

### Why skills live under `skills/<name>/` instead of the repository root

This is not arbitrary — it is where two specs intersect:

- **DSH filesystem skill discovery scans exactly one level**: `<root>/<name>/SKILL.md`, no nesting
- **The Codex/OpenAI plugin spec requires** `plugin.json`'s `skills` field to point at a directory
  **named `skills`**

Putting skills under `skills/` satisfies both, so **one source of truth ships as three packages** —
a DSH plugin, a Codex plugin, and a plain agent skill — with no duplicated copies.

### Adding a skill

1. `skills/<name>/SKILL.md` — the body. Frontmatter requires `name` (kebab-case, **must match the
   directory name**) and `description`
2. `skills/<name>/README.md` — the human-facing intro, usage and installation
3. Add a row to the [Skills](#skills) table above
4. Run the checks:

```powershell
.\scripts\Fix-Bom.ps1                                 # encoding / BOM
.\skills\<name>\scripts\Test-SkillHealth.ps1 -Deep    # per-skill self-check (if present)
node scripts\self-test.mjs                            # collection registration logic
```

**`index.js` needs no changes** — it iterates `skills/` and registers every directory containing a
`SKILL.md`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). **The single most important rule is the BOM convention** —
these skills target Windows PowerShell, and PS 5.1 is extremely sensitive to encoding:
`.ps1` must **have** a BOM while `SKILL.md` must **not**, two opposite requirements that are easy to
get backwards.

## Security

Skills here may **modify or delete files on your machine** (disk-butler cleans up disk space, for
example). Each skill's own README documents its safety model — **read it before use**.
See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

[MIT](LICENSE) © Aurirlk
