# Aurirlk DSH Skills

**A collection of DSH skills. Install once, and your agent picks up a dozen new trades.**

[![verify](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml/badge.svg)](https://github.com/Aurirlk/Aurirlk-DSH-skills/actions/workflows/verify.yml)

[中文](README.md) | **English**

---

## What this is

DeepSeek Harness (DSH for short) is an agent framework — think of it as an AI assistant that can read files, run commands, and call tools. [Repo](https://github.com/deepseek-ai/deepseek-harness) · [Docs](https://deepseek-harness.github.io/deepseek-harness/)

Out of the box it is a jack of all trades and master of none.

**A skill is how you give it a trade.**

One skill is a written brief: here is the order to do this kind of work in, here is what you must not do, here is when you should stop and ask.

This repository is the collection I have built up. **Install it once and every skill is live**, and a `git pull` keeps you current.

> Skills come in two kinds here: **original** (I wrote them) and **adapted** (built on someone else's work).
> Every adapted skill has its source, licence, and a description of what changed in [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).

---

## You probably need one of these

| What you are dealing with | Reach for |
|---|---|
| The C drive is full and you do not know what is safe to delete | **disk-butler** |
| You need an architecture diagram and refuse to drag boxes by hand | **drawio** |
| You have to write release notes for non-technical readers | **speak-human** |
| Production broke and after two hours you realise you started in the wrong place | **systematic-rca** |
| You want to query the database in plain language without leaking another tenant's rows | **nl2sql-analyst** |
| One assistant, many capabilities, and nobody knows who should answer what | **agent-orchestration** |
| Judging a scene from surveillance footage and your eyes keep playing tricks | **visual-scene-judge** |
| You need to know whether an agent actually followed the instructions | **agent-trace-eval** |
| You want to rehearse interviews against a real job description | **interview-skills** |
| The code is full of duplication and you are afraid to touch it | **code-review-refactor** |
| A service is running and you want to know your Java edits compile | **live-jvm-compile-check** |
| You committed and pushed, but aren't sure it landed | **git-submit-safety** |
| You changed the schema and someone else has to run the script | **db-change-report** |
| Random 500s, connection pool exhausted | **db-pool-forensics** |
| You overwrote the files but production still serves the old build | **deploy-access-chain** |
| Streaming chat: broken tables, spinner after the answer, no history | **agent-chat-endpoint** |
| You want to give the agent a tool that mutates data, safely | **agent-tool-safety** |
| You suspect fake data or a feature that was never wired up | **no-stub-delivery** |
| A teammate cloned the repo and `.env` is missing, so nothing runs | **env-config** |
| The backend changed a DTO and the frontend has seven spots to touch | **vue3-admin-frontend** |
| You want to know the locale files, the type table and dead props are clean, without a dev server | the `Test-FrontendHealth.mjs` shipped with **vue3-admin-frontend** |
| You want to commit and the docs haven't moved a line | **docs-code-sync** |
| The page is wrong and you can't tell which layer is at fault | **frontend-delivery-method** |
| You inherited an unfamiliar repo and need a map both people and agents can query | **repo-skill-forge** |
| You moved to a new repo and need to know whether old patches still apply | **git-repo-divergence-check** |
| `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS` and `node_modules` never appears | **pnpm-cli-repair** |
| You want to know whether a major is recommended or a dead end in the AI era | **career-ai-strategist** |
| Turning a portrait into a 12-cell chibi sticker sheet | **chibi-sticker-pro** |
| Optimising a prompt or writing one from a template | **prompt-architect** |
| You only have a vague idea and want to be interviewed before getting a prompt | **prompt-consultant-master** |
| Organising scattered LLM dev notes into a technical document | **llm-notes-architect** |
| Proofreading Chinese copy, with a change table and a clean final draft | **chinese-text-proofreader** |

---

## Skill catalogue

**36 skills** in total.

### System tools

| Skill | When to use it | Platform | Docs |
|---|---|---|---|
| **disk-butler** | C drive is full: shows where the space went, cleans up by risk level, moves caches that are hard-wired to C: onto another drive, and keeps a local record | Windows | [English](skills/disk-butler/README.en.md) · [中文](skills/disk-butler/README.md) |
| **pnpm-cli-repair** | Two frequent pnpm failures: `pnpm -v` dies with MODULE_NOT_FOUND (shim points at a stale misspelled path), or pnpm 11's `ERR_PNPM_IGNORED_BUILDS` (build scripts not approved) — triage by keyword, don't mix them up | original | [English](skills/pnpm-cli-repair/README.en.md) · [中文](skills/pnpm-cli-repair/README.md) |

### Documents & diagrams

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **drawio** | Drawing an architecture diagram: write a few lines of JSON, get a diagram; batch export to PNG/SVG/PDF; reports overlapping boxes before you export | original | [English](skills/drawio/README.en.md) · [中文](skills/drawio/README.md) |
| **speak-human** | Explaining a technical change to business readers: three-step rewrite into plain language, with the jargon and marketing filler stripped out | original | [English](skills/speak-human/README.en.md) · [中文](skills/speak-human/README.md) |
| **docs-code-sync** | About to commit after a code change: run the change → doc mapping, reconcile with source-over-docs priority, then scan for stale paths and version numbers | original | [English](skills/docs-code-sync/README.en.md) · [中文](skills/docs-code-sync/README.md) |

### Front-end (Nuxt 4 / Vue 3 / Vuetify 3)

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **frontend-delivery-method** | Frontend from ticket to usable product: three questions before starting, three levels of "it runs", pinned dependencies, decide who scrolls, reactivity traps, splitting giant components — plus a triage tree | original | [English](skills/frontend-delivery-method/README.en.md) · [中文](skills/frontend-delivery-method/README.md) |
| **code-review-refactor** | Duplication is piling up: find it, collapse it, turn near-identical pages into config-driven ones | adapted | [English](skills/code-review-refactor/README.en.md) · [中文](skills/code-review-refactor/README.md) |
| **git-commit-message-generator** | Writing a commit: classify as feat/fix/docs, and no "updated" or "changed" in the subject | adapted | [English](skills/git-commit-message-generator/README.en.md) · [中文](skills/git-commit-message-generator/README.md) |
| **ui-tip** | Toast messages are inconsistent: success uses the default, errors must name their icon | adapted (content changed) | [English](skills/ui-tip/README.en.md) · [中文](skills/ui-tip/README.md) |
| **ui-use-confirm** | Which actions need a confirmation dialog: settle the rule once instead of deciding each time | adapted (content changed) | [English](skills/ui-use-confirm/README.en.md) · [中文](skills/ui-use-confirm/README.md) |
| **vuetify0** | Building components with `@vuetify/v0`: how the headless components and composables are meant to be used | official skill | [English](skills/vuetify0/README.en.md) · [中文](skills/vuetify0/README.md) |
| **vue3-admin-frontend** | Admin pages on Vue 3 + Naive UI + UnoCSS: `useTable` for lists, drawer forms, i18n in two places, and seven spots to touch when a DTO changes. **Ships a zero-dependency health checker** (array `columns`, i18n value/type drift, dead props) with fixture-backed self-tests | original | [English](skills/vue3-admin-frontend/README.en.md) · [中文](skills/vue3-admin-frontend/README.md) |

### Backend & operations

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **live-jvm-compile-check** | The service is running and you want to verify Java edits build: borrow the live JVM's classpath, compile into a temp dir | original | [English](skills/live-jvm-compile-check/README.en.md) · [中文](skills/live-jvm-compile-check/README.md) |
| **db-change-report** | You changed the database and someone else must execute it: five mandatory disclosures plus idempotent SQL and history-table rollback | original | [English](skills/db-change-report/README.en.md) · [中文](skills/db-change-report/README.md) |
| **db-pool-forensics** | Connection pool exhausted: separate "borrowed dry" from "DB refusing", find the holders, throttle at the single choke point | original | [English](skills/db-pool-forensics/README.en.md) · [中文](skills/db-pool-forensics/README.md) |
| **deploy-access-chain** | You overwrote the files and production still serves the old build: prove which host and directory the request hits before shipping again | original | [English](skills/deploy-access-chain/README.en.md) · [中文](skills/deploy-access-chain/README.md) |
| **env-config** | `.env` is missing config: three layers (file exists → value set → value valid) to get the project running; placeholders and relative paths count as unset | original | [English](skills/env-config/README.en.md) · [中文](skills/env-config/README.md) |

### Delivery & collaboration

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **git-submit-safety** | Commit and push discipline: no `add -A`, precise pathspecs, trust `ls-remote` over the local tracking ref, fast-forward only on divergence — and a pre-build checklist handed over after every push | original | [English](skills/git-submit-safety/README.en.md) · [中文](skills/git-submit-safety/README.md) |
| **no-stub-delivery** | Truthfulness audit before delivery: fake data, fake implementations (written but never wired), fake completion | original | [English](skills/no-stub-delivery/README.en.md) · [中文](skills/no-stub-delivery/README.md) |
| **repo-skill-forge** | Scans a repo and generates one developer guide plus six query skills (map / symbols / calls / impact / request trace / change playbook), with an index and a verifier; judgement is left as numbered TODOs instead of being invented by a script | original | [English](skills/repo-skill-forge/README.en.md) · [中文](skills/repo-skill-forge/README.md) |
| **git-repo-divergence-check** | Before migrating repos or branches: blobless clone + blob SHA comparison tells you whether merge is even possible and which paths are pure additions that can move with zero conflicts | original | [English](skills/git-repo-divergence-check/README.en.md) · [中文](skills/git-repo-divergence-check/README.md) |

### Job hunting / interviews

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **create-interviewer** | Rehearsing against the same interviewer repeatedly: freeze their thinking style, preferences, and question habits into an AI persona | adapted (MIT) | [English](skills/create-interviewer/README.en.md) · [中文](skills/create-interviewer/README.md) |
| **interview-skills** | Mock interviews at big tech: give it the company, role, JD, and résumé; it asks questions and contrasts good vs bad answers | adapted (MIT) | [English](skills/interview-skills/README.en.md) · [中文](skills/interview-skills/README.md) |
| **career-ai-strategist** | Career outlook for a major: red-ocean vs blue-ocean demand, the gap between coursework and real jobs, tier-1 salaries, and AI-displacement risk — no "bright prospects" filler | original persona | [English](skills/career-ai-strategist/README.en.md) · [中文](skills/career-ai-strategist/README.md) |

### Personas & content production

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **chibi-sticker-pro** | Portrait → 12-cell blind-box chibi sticker sheet: facial-geometry mapping first, then 12 distinct emotions, white background and thick white borders | original persona | [English](skills/chibi-sticker-pro/README.en.md) · [中文](skills/chibi-sticker-pro/README.md) |
| **prompt-architect** | Optimise or write a structured prompt: RTF/CRISPE/ReAct, few-shot/CoT, negative constraints, plus technique notes and model picks | original persona | [English](skills/prompt-architect/README.en.md) · [中文](skills/prompt-architect/README.md) |
| **prompt-consultant-master** | When you only have a vague idea: adaptive interview, max 2 questions per turn, delivers a production-grade de-AI-voiced system prompt only after the profile is confirmed | original persona | [English](skills/prompt-consultant-master/README.en.md) · [中文](skills/prompt-consultant-master/README.md) |
| **llm-notes-architect** | Scattered LLM dev notes → technical doc: pain point / solution / code / pitfall structure, auto Tech Stack tags, code logic never altered | original persona | [English](skills/llm-notes-architect/README.en.md) · [中文](skills/llm-notes-architect/README.md) |
| **chinese-text-proofreader** | Chinese proofreading and polishing: typos in red, faulty sentences in green, a before/after table and a ready-to-use final draft | original persona | [English](skills/chinese-text-proofreader/README.en.md) · [中文](skills/chinese-text-proofreader/README.md) |

### AI evaluation

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **agent-trace-eval** | Deciding whether an agent did what it was told: walk its call trace step by step, mark what went wrong, how bad, and how to fix it | original | [English](skills/agent-trace-eval/README.en.md) · [中文](skills/agent-trace-eval/README.md) |

### Reasoning & diagnosis

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **systematic-rca** | Something broke and you need the cause: see the facts, list the possibilities, rule them out, then act — it exists to stop you jumping to a conclusion | original | [English](skills/systematic-rca/README.en.md) · [中文](skills/systematic-rca/README.md) |
| **visual-scene-judge** | Judging state from surveillance footage: state what is visible first, then cross-check four dimensions, and report conflicts honestly | original | [English](skills/visual-scene-judge/README.en.md) · [中文](skills/visual-scene-judge/README.md) |

### Agent orchestration

| Skill | When to use it | Origin | Docs |
|---|---|---|---|
| **agent-orchestration** | One assistant, many capabilities: who answers what, how context is remembered, and how a dashboard and a chat box say the same thing differently | original | [English](skills/agent-orchestration/README.en.md) · [中文](skills/agent-orchestration/README.md) |
| **nl2sql-analyst** | Querying a database in plain language: turns a question into SQL, never crosses tenants, and says "no data" instead of inventing numbers | original | [English](skills/nl2sql-analyst/README.en.md) · [中文](skills/nl2sql-analyst/README.md) |
| **agent-chat-endpoint** | The four pieces of a streaming chat endpoint: keep whitespace deltas, never park slow work at the stream tail, read auth on the request thread, bound compression by message id | original | [English](skills/agent-chat-endpoint/README.en.md) · [中文](skills/agent-chat-endpoint/README.md) |
| **agent-tool-safety** | Giving an agent a mutating tool: `draft_*` naming, two-phase confirmation, scoped changes, assembly-layer switches, read-only sandboxes | original | [English](skills/agent-tool-safety/README.en.md) · [中文](skills/agent-tool-safety/README.md) |

### Someone else's projects (not in this repo)

| Project | Notes |
|---|---|
| **[ASu-skills](https://github.com/Hisn00w/ASu-skills)** | A job-hunting skill collection (5.4k ⭐): resume distillation, interview prediction and follow-up drilling, autumn recruiting tracker. Aurirlk contributed OpenCode plugin support ([PR #80](https://github.com/Hisn00w/ASu-skills/pull/80)) |
| **[@vuetify/v0](https://0.vuetifyjs.com/)** | Where this repository's `vuetify0` skill comes from — the headless logic layer for Vue 3 |

<!-- When adding a skill, add a row above and make sure skills/<name>/README.md exists -->

---

## Ecosystem index: skill repositories worth knowing

All **34 repositories** below were checked against the GitHub API on 2026-11-23: they exist, are not archived, and the star counts are the values measured that day (**they change — trust the linked page**). Three groups: official/standards for the format, general collections to adapt, personal/domain packs to study how others distill a method into a skill.

**These are entry points, not endorsements.** Check the licence, dependencies and scripts before installing anything third-party; when in doubt, run a security scanner first. This collection copies none of their content and does not track their updates.

### Official & standards (learn the format first)

| Repository | Stars | What it gives you |
| :--- | ---: | :--- |
| [anthropics/skills](https://github.com/anthropics/skills) | 199.1k | Anthropic reference skills: document suites, frontend-design, skill-creator |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 48.0k | Official plugin marketplace: how skills, commands and hooks are packaged |
| [openai/skills](https://github.com/openai/skills) | 28.9k | Official Codex skills from OpenAI |
| [google/skills](https://github.com/google/skills) | 24.6k | Official skills for Google products and technologies |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | 41.5k | Official Copilot instructions, agents, skills and configurations |
| [agentskills/agentskills](https://github.com/agentskills/agentskills) | 27.5k | The Agent Skills specification: format, fields, progressive loading |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 34.8k | Vercel official frontend / React / Next.js skills |
| [huggingface/skills](https://github.com/huggingface/skills) | 11.4k | Skills for model training, evaluation, Spaces and Jobs |
| [expo/skills](https://github.com/expo/skills) | 4.2k | Official React Native skills: native UI, data, CI/CD |
| [trailofbits/skills](https://github.com/trailofbits/skills) | 8.4k | Security-audit skills, including contract audits and vulnerability scanning |
| [microsoft/skills](https://github.com/microsoft/skills) | 3.2k | Azure SDK / Foundry skills for enterprise stacks |

### General collections & indexes (adapt, do not start from zero)

| Repository | Stars | What it gives you |
| :--- | ---: | :--- |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 330.6k | The author’s own .agents directory — practical engineer-to-engineer skills |
| [obra/superpowers](https://github.com/obra/superpowers) | 324.2k | A skills framework plus engineering methodology, 20+ composable skills |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | 309.1k | Harness performance system: skills, instincts, memory and security |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 119.8k | Production-grade engineering skills organised as a delivery pipeline |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 80.1k | A curated index of 1000+ Claude skills and tools |
| [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | 50.2k | 3000+ reusable skills with a multi-harness installer |
| [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) | 53.9k | 5400+ OpenClaw skills, filtered for spam and malware |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 37.5k | 1000+ skills indexed by source (official / community) |
| [wshobson/agents](https://github.com/wshobson/agents) | 42.8k | Plugins, agents, skills and commands across several harnesses |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 30.3k | 410+ skills, 120+ agents and custom commands for many roles |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 58.6k | Hand-picked Claude Code resources and skills |
| [composio-community/awesome-codex-skills](https://github.com/composio-community/awesome-codex-skills) | 17.4k | A curated list of practical Codex workflow skills |
| [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 34.1k | A registry and CLI for Claude Code components |

### Personal & domain-specific (see how others distill method into skills)

| Repository | Stars | What it gives you |
| :--- | ---: | :--- |
| [KKKKhazix/khazix-skills](https://github.com/KKKKhazix/khazix-skills) | 22.5k | A Chinese personal skills collection: goal setting, code hygiene, analysis |
| [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills) | 27.8k | Content production from writing and art to layout and publishing |
| [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | 235.1k | A single-file behavior guide distilled from Karpathy’s ideas |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 62.1k | Marketing skills: CRO, copywriting, SEO and analytics |
| [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 58.1k | A skill library that turns an agent into a research assistant |
| [obsidianmd/obsidian-skills](https://github.com/obsidianmd/obsidian-skills) | 53.5k | Teach an agent to work with Obsidian, Markdown, Bases and JSON Canvas |
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 36.6k | 817 cybersecurity skills mapped to six frameworks including MITRE |
| [tmstack/awesome-persona-skills](https://github.com/tmstack/awesome-persona-skills) | 4.7k | An index of persona skills — colleagues, boss, mentor and more |
| [libukai/awesome-agent-skills](https://github.com/libukai/awesome-agent-skills) | 5.2k | A Chinese guide to Agent Skills: quickstart, resources and picks |
| [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector) | 27.3k | A security scanner for skills; worth running before installing third-party packs |

## Installation

Assumes DSH is already installed and you have a profile directory (typically `~/.dsh/profiles/desktop` — use whatever yours is called).

### Install everything (recommended)

```powershell
# Windows
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

```bash
# macOS / Linux
cd ~/.dsh/profiles/desktop
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

**No restart needed.** DSH picks up everything under `skills/` on its own. Measured at roughly **7 seconds**.

To update later:

```powershell
pnpm update dsh-aurirlk-skills
```

> ⚠️ **Don't run `pnpm add dsh-aurirlk-skills`** (without the `github:` prefix). The package has not been published to the npm registry, so that command fails. Use the git URL above — the contents are identical.

### Install just one skill

Skills work as directly linked directories, so no package install is needed:

```powershell
# Windows: a junction needs no administrator rights (a symlink would)
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\disk-butler" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\disk-butler"
```

```bash
# macOS / Linux: a symlink
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git ~/dev/Aurirlk-DSH-skills
ln -s ~/dev/Aurirlk-DSH-skills/skills/disk-butler ~/.dsh/skills/disk-butler
```

Which to choose:

| | Whole collection | Single skill |
|---|---|---|
| Best for | People who want to follow updates | People who use one or two skills |
| Skills added later | Arrive automatically | Do not appear |
| Updating | `pnpm update` | `git pull` — it is a link, not a copy |

**Both options link, they do not copy.** After a `git pull` the skill is already current, with nothing to move.
The skills directory is watched, so **adding, renaming, or deleting needs no restart**.

### Using this with other agents

The skill itself is just `skills/<name>/SKILL.md` and **does not depend on DSH**.

Claude Code, Codex, and anything else that understands `SKILL.md` can use it directly:

- **Codex / OpenAI plugins**: the repo ships `.codex-plugin/plugin.json`; install it the way that ecosystem expects
- **Manually**: copy `skills/<name>/` into that agent's skills directory

### Checking that it worked

Just say "my C drive is full" or "take a look at my machine" — the agent should load **disk-butler** on its own.

You can also run the skill's self-check by hand:

```powershell
& "$env:USERPROFILE\.dsh\skills\disk-butler\scripts\Test-SkillHealth.ps1" -Deep
```

---

## FAQ

**Installed it, nothing happened.**
Check the directory name matches the `name` in `SKILL.md`. No restart is required, but DSH does have to be able to see the directory.

**Will it delete my files?**
Skills that touch your machine (disk-butler is one) document their safety model in their own README — **they show you the list first and grade it by risk**. Read that README before you run anything.

**Can I install only some of them?**
Yes — see "Install just one skill" above. Link as many as you like; they do not interfere.

**How is this different from an npm package?**
`package.json` is a valid npm package, but it is unpublished. Installing via git gives you exactly the same content.

---

## Repository layout

```
Aurirlk-DSH-skills/
├── README.md                  ← you are here
├── LICENSE / CONTRIBUTING.md / SECURITY.md / CHANGELOG.md
├── .github/workflows/verify.yml    ← CI: validates every skill
├── index.js / cordis.patch.yml / package.json   ← the bundle package (registers all skills)
├── .codex-plugin/plugin.json       ← Codex / OpenAI plugin manifest
├── scripts/                        ← repository dev tooling (not published)
└── skills/
    └── disk-butler/           ← one skill
        ├── README.md          ← human-facing: intro / usage / install
        ├── SKILL.md           ← the skill itself (what the agent reads)
        ├── scripts/           ← executable scripts
        └── references/        ← reference docs loaded on demand
```

---

## Adding a skill

Three steps:

1. `skills/<name>/SKILL.md` — the skill itself. Start with front matter containing at least `name` (kebab-case, **must match the directory name**) and `description`
2. `skills/<name>/README.md` — human-facing intro, usage, install
3. Add a row to the [skill catalogue](#skill-catalogue) above, then run the checks:

```powershell
.\scripts\Fix-Bom.ps1                              # encoding and BOM
.\skills\<name>\scripts\Test-SkillHealth.ps1 -Deep  # that skill's self-check, if it has one
node scripts\self-test.mjs                          # bundle registration logic
```

**`index.js` needs no change.** It walks `skills/` and registers every directory that has a `SKILL.md`.

### Why skills must live under `skills/<name>/`

Not an arbitrary choice — it is where two rules meet:

- DSH scans **one level** for skills: `<root>/<name>/SKILL.md`, no nesting
- The Codex / OpenAI plugin spec requires `plugin.json`'s `skills` field to point at a directory **named `skills`**

`skills/<name>/` satisfies both, and one source of truth can be distributed three ways (DSH plugin / Codex plugin / generic agent skill) without maintaining copies.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

**The single most important rule is BOM.** This repo's tooling is mostly Windows PowerShell, and PS 5.1 is picky about encoding:

- `.ps1` files **must have** a BOM
- `SKILL.md` **must not have** a BOM

The two directions are opposite and easy to get backwards — and getting it wrong does not error, it just fails silently.

## Security

Skills here **may modify or delete files on your machine** (disk-butler exists for exactly that).

Each skill's own README documents its safety model — **read it before use**. To report a vulnerability, follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Aurirlk
