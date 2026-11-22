# repo-skill-forge

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Turn an unfamiliar repository into a working skill pack: **one developer guide plus six query skills**,
all backed by a real index, cited sources, and a verification gate.

## What it fixes

The first three days on a large codebase go into finding files, guessing responsibilities, and asking
people. None of that produces code, and the next person starts over.

An LLM can read the code, but it forgets — the next session needs the whole story again. What should
survive is not "the understanding from one conversation" but **a map you can query, verify and rebuild**.

One boundary is non-negotiable:

> **The machine delivers facts. Judgement must be written by someone who read the code.**

A script's guess at "this module handles X" is wrong often enough to be harmful: a guide with the wrong
responsibility statement misleads every person who reads it next.

## What you get

```
OUT/
├── repo-index/                    # index + query CLI (generated)
│   ├── facts.json                 # modules, commands, endpoints, entities, config keys, hotspots
│   ├── FACTS.md                   # human-readable facts — check scan accuracy here first
│   ├── index.json                 # symbol index (definitions, import edges, references)
│   └── bin/query.mjs              # one CLI shared by all six query skills
└── skills/
    ├── <repo>-dev-guide/          # the guide
    │   ├── SKILL.md               # entry point, routed by task type
    │   ├── AGENT-CHECKLIST.md     # numbered TODO list: where, what to write
    │   └── references/
    │       ├── 00-overview.md     # size, languages, stack, commands (with provenance)
    │       ├── 01-modules.md      # modules + actual cross-module import flow
    │       ├── 02-entrypoints.md  # where the process starts, first hop
    │       ├── 03-api.md          # endpoints and routes, grouped by module
    │       ├── 04-datamodel.md    # entity ↔ table, facts vs inference marked
    │       ├── 05-config.md       # config keys only, secrets flagged
    │       ├── 06-conventions.md  # naming distribution, tooling, tech debt
    │       ├── 07-landmines.md    # biggest files, highest fan-in, untested modules
    │       └── 10-module-*.md     # one volume per module
    ├── <repo>-repo-map/           # where things live
    ├── <repo>-symbol-lookup/      # definitions and references
    ├── <repo>-call-graph/         # caller/callee with confidence
    ├── <repo>-impact-analysis/    # what breaks if I change this
    ├── <repo>-request-trace/      # endpoint → handler → table
    └── <repo>-change-playbook/    # ordered steps to add an endpoint/field/page/job
```

**Line count comes from breadth, not padding**: one line per file, per endpoint, per table, per config key.
Measured: ~3,200 guide lines for a 1,400-file backend, ~1,300 for a 360-file frontend.

## Running it

```bash
SKILL=<path to this skill>
REPO=<target repository>
OUT=<output pack directory>

# one shot (recommended): scan → index → emit → verify
node "$SKILL/scripts/forge.mjs" "$REPO" --out "$OUT" --name my-repo

# or the four steps individually, when you need to debug one of them
node "$SKILL/scripts/scan-repo.mjs"   "$REPO" --out "$OUT/repo-index" --name my-repo
node "$SKILL/scripts/build-index.mjs" "$REPO" --out "$OUT/repo-index" --facts "$OUT/repo-index/facts.json"
node "$SKILL/scripts/emit-skills.mjs" --facts "$OUT/repo-index/facts.json" \
                                      --index "$OUT/repo-index/index.json" --out "$OUT"
node "$SKILL/scripts/verify-skillpack.mjs" "$OUT"
```

All three steps are read-only on the target repo. Measured on a 1,400-file backend:
scan 1.8s, index 1.4s, emit 0.2s.

The pack ships `repo-index/bin/rebuild.sh` so later rebuilds are one command.

## Three design decisions

### 1. Six skills, one index

Separate indexes produce different answers for the same symbol, and the user has no way to tell which
one to trust. Here the six skills differ only in *how you ask*; the answers come from one `index.json`.

```bash
Q="node $OUT/repo-index/bin/query.mjs"
$Q where AgentController#create     # definition
$Q callers create                   # who calls it (high/medium)
$Q impact src/.../Result.java       # blast radius
$Q route /api/agent                 # endpoint down to tables
$Q stats                            # highest fan-in files
```

### 2. Confidence is part of the answer

| Edge | Confidence | Basis |
|---|---|---|
| import / component usage | `high` | syntax |
| "who references this name" | `medium` | name match; homonyms collide |

`medium` is a lead, not a conclusion. Every inference built on it is labelled "confirm by type".
Mixing the two together dresses guesses up as facts.

### 3. Judgement is left as numbered TODOs

`AGENT-CHECKLIST.md` lists items like `M-<module>-1..3`. Fill them by reading code; if there is genuinely
nothing to report, write "no module-specific risk found" and delete the marker. **Placeholders are not
allowed** — a placeholder reads as "someone already checked this".

`verify-skillpack.mjs --strict` counts the markers. Non-zero means not delivered.

## What the verifier checks

| Check | Rule |
|---|---|
| Structure | every skill has SKILL.md, frontmatter, a top-level heading |
| **Paths** | every backticked path in the docs exists in the repo |
| Coverage | every module has a volume and a row in the module table |
| Endpoints | every endpoint's source file exists |
| TODO | zero remaining under `--strict` |
| Index | non-empty, `meta.root` exists, not out of sync with disk |
| Portability | no absolute paths in the docs |

The second one is the core: **a guide citing twenty files that do not exist is more deceptive than no
guide at all.**

## What it figures out on its own

| Fact | Source |
|---|---|
| Modules and size | `pom.xml` / npm workspaces / `settings.gradle` / `go.mod` |
| Build and verify commands | read from config, tagged `declared` or `convention` |
| HTTP endpoints | annotation parsing, **including two-level constant resolution** |
| Frontend routes | `path` / `name` in the router table |
| Entity ↔ table | `@TableName` / `@Table`, else naming convention marked as inference |
| Config keys | `.env` / `application*.yml` / `@Value` / `import.meta.env`, **keys only** |
| Hotspots and risk | file size, fan-in, untested modules |
| Tech debt | `TODO`/`FIXME`/`HACK` with locations, `any`, `console.log` |

## What it cannot do

- **Extraction is regex-level**: overloads, generic specialisation and dynamic imports distort; "who calls
  it" is name matching.
- **Symbols only for** Java / Kotlin / TS / JS / Vue / Svelte / Python / Go. Other languages get
  file-level stats only.
- **Invisible**: reflection, Spring bean lookup by name, message-queue consumers, class names in config,
  generated code.
- **Java same-package references carry no import**, so they only show up as `medium`. That is the
  language, not a gap.
- **Constants defined outside the repo** leave endpoint paths as `<NAME>` with `resolved:false`. Those are
  not contracts.

Per-language detail: [`references/extraction-limits.md`](references/extraction-limits.md).

## The guide goes stale

Code changes, the guide drifts:

- Rebuild the index any time (`rebuild.sh`) — queries are accurate again immediately.
- The guide must be regenerated; **filled-in TODO prose is lost**, so keep those additions in version
  control or in the PR.
- When the guide and the index disagree, the index wins.

## Related

- [`references/output-shape.md`](references/output-shape.md) — what each volume is for, and how it goes wrong
- [`references/extraction-limits.md`](references/extraction-limits.md) — per-language capability and distortion
- [`references/writing-todos.md`](references/writing-todos.md) — writing TODOs that are actually useful

Pair with [docs-code-sync](../docs-code-sync/README.en.md) and
[no-stub-delivery](../no-stub-delivery/README.en.md).
