# Aurirlk DSH Skills

> **My DSH skill-sharing repository.** One directory per skill, each with **bilingual READMEs**
> covering usage and installation.
>
> Two kinds of content live here:
> - **Original** — written and used by me (e.g. disk-butler)
> - **Adapted** — built from someone else's or an official published skill, reworked to the DSH spec
>
> Every adapted skill records its **source, licence and exactly what we changed** in
> [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).

[![verify](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml/badge.svg)](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml)

**English** | [中文](README.md)

---

## Skills

### System tools

| Skill | What it does | Platform | Docs |
|---|---|---|---|
| **disk-butler** | Windows computer butler: find out where C/D/E space went → clean junk by safety tier → migrate hard-coded caches transparently with NTFS junctions → keep a durable machine archive | Windows | [English](skills/disk-butler/README.en.md) · [中文](skills/disk-butler/README.md) |

### Front-end (Nuxt 4 / Vue 3 / Vuetify 3)

| Skill | What it does | Origin | Docs |
|---|---|---|---|
| **code-review-refactor** | Actionable code review and refactoring: duplicated logic, CSS de-duplication, config-driven pages | adapted | [English](skills/code-review-refactor/README.en.md) · [中文](skills/code-review-refactor/README.md) |
| **git-commit-message-generator** | Conventional Commits messages with subjects that actually say something | adapted | [English](skills/git-commit-message-generator/README.en.md) · [中文](skills/git-commit-message-generator/README.md) |
| **ui-tip** | One convention for global toasts: success uses defaults, **errors must set the icon** | adapted (body changed) | [English](skills/ui-tip/README.en.md) · [中文](skills/ui-tip/README.md) |
| **ui-use-confirm** | One convention for confirmation dialogs, plus which actions must confirm first | adapted (body changed) | [English](skills/ui-use-confirm/README.en.md) · [中文](skills/ui-use-confirm/README.md) |
| **vuetify0** | Using and authoring with `@vuetify/v0` headless components and composables | official skill | [English](skills/vuetify0/README.en.md) · [中文](skills/vuetify0/README.md) |

### Job hunting / interviews

| Skill | What it does | Origin | Docs |
|---|---|---|---|
| **create-interviewer** | Distils an interviewer into a continuously-evolving AI persona (tech map + behaviour archive + persona) | adapted (MIT) | [English](skills/create-interviewer/README.en.md) · [中文](skills/create-interviewer/README.md) |
| **interview-skills** | Big-tech AI mock interviewer: questions from company + role + JD + resume, with good-vs-bad answers and multi-round simulation | adapted (MIT) | [English](skills/interview-skills/README.en.md) · [中文](skills/interview-skills/README.md) |

> Sources and licences are documented in [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).

---

## Related projects

These live **outside this repository** (they have homes of their own — re-uploading would be
pointless), so they are listed as recommendations only:

| Project | Notes |
|---|---|
| **[ASu-skills](https://github.com/Hisn00w/ASu-skills)** | A job-hunting skill collection (5.4k ⭐): resume "distillation", interview prediction and follow-up drilling, autumn recruiting tracker, open-source contribution helper. Aurirlk contributed OpenCode plugin support ([PR #80](https://github.com/Hisn00w/ASu-skills/pull/80)) |
| **[@vuetify/v0](https://0.vuetifyjs.com/)** | Where this repository's `vuetify0` skill comes from — the headless logic layer for Vue 3 |

<!-- When adding a skill, add a row above and make sure skills/<name>/README.md exists -->

---

## Installation

> **This repository is a public git repository and can be used directly as a package source.**
> No npm registry and no npm account required.

### Option 1 — install the whole collection (recommended)

Add this repository as a dependency of your DSH profile to **register every skill at once**:

```powershell
# Windows — your profile directory may not be called `desktop`; use whatever you have
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

```bash
# macOS / Linux
cd ~/.dsh/profiles/desktop
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

DSH then reads the package's `dsh.bundle.patch` and registers every skill under `skills/`.
Measured at roughly **7 seconds**.

**Updating to the latest version:**

```powershell
pnpm update dsh-aurirlk-skills
```

### Option 2 — link a single skill

DSH discovers skills by scanning **one level** under a skill root (`<root>/<name>/SKILL.md`),
so you can link just one skill instead of the whole repository — no package install needed:

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

> **Which option to pick:**
> - Option 1 installs the whole collection; skills you add later show up automatically.
>   Good if you want to follow upstream.
> - Option 2 links a single skill; the repository's other skills stay out of your environment.
>   Good if you only want one of them.
>
> Both use a junction/symlink, so after `git pull` the skill is already up to date — no copying.
> DSH watches skill roots, so added / renamed / removed skills take effect **without a restart**.

### Option 3 — other agents

The skill body is just `skills/<name>/SKILL.md` and **does not depend on DSH**.
Any agent that understands `SKILL.md` (Claude Code, Codex, …) can use the directory directly.
The repository also ships `.codex-plugin/plugin.json` for the Codex/OpenAI plugin flow.

### Verifying the install

```powershell
# Just ask the agent: "my C drive is full" — it should load disk-butler automatically.
# Or run the skill's self-check by hand:
& "$env:USERPROFILE\.dsh\skills\disk-butler\scripts\Test-SkillHealth.ps1" -Deep
```

> **A note on npm**: this repository's `package.json` is a valid npm package
> (`dsh-aurirlk-skills`), but it has **not been published to the npm registry**, so
> `pnpm add dsh-aurirlk-skills` will fail today. Use Option 1 instead.
> The git install and an npm install would ship identical contents.

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
