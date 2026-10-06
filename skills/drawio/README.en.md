# drawio · draw.io diagram generation and linting

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to the repository index](../../README.en.md)

**English** | [中文](README.md)

> A draw.io skill for AI agents, three tracks:
> **① Generate** — build `.drawio` files from a JSON spec with automatic layered layout; you never write coordinates
> **② Export** — page-by-page export to PNG / SVG / PDF
> **③ Lint** — catch overlapping boxes, shapes escaping their container, edges routed through boxes, and text overflow *before* you export
>
> Ships both as a DSH plugin (`dsh.bundle.patch`) and as a plain agent skill (`SKILL.md`).

---

## The problem it solves

When an agent draws an architecture diagram, the usual failure is not "it can't draw" — it's
**it draws, but the layout is broken**:

- Boxes overlap, so two modules read as one
- Modules poke outside the boundary of their layer container
- Orthogonal edges "take shortcuts" and cut straight through boxes in between, so you can't tell
  what connects to what
- Text overflows its box and gets clipped

None of these make the file invalid. The `.drawio` still opens and still exports.
They just make the diagram useless — and **you cannot see them in a thumbnail**:
a few pixels of overflow is invisible at 20% zoom, and in a dense area two overlapping boxes
look like a deliberate group.

The drawio skill's approach:

1. **You don't write coordinates** — you describe structure (which layers, which modules per layer,
   what connects to what) and horizontal positions are computed by dividing each layer evenly.
   That rules out overlap and overflow mathematically.
2. **Lint before exporting** — geometry checks for the things human eyes miss, reported by cell id.
3. **The CLI's traps are sealed off** — draw.io's command line has three behaviours that produce
   wrong output *without any error*. All three are handled in the scripts.
4. **Output hashes are cross-checked** — if two exported pages are byte-identical, something went
   wrong; the script warns instead of silently handing you N copies of page 1.

## Three tracks

| What you want | Track | Side effects | Needs draw.io desktop |
|---|---|---|---|
| "Draw an architecture diagram" | **Generate** | writes a file | no |
| "Export to PNG / SVG / PDF" | **Export** | writes files | **yes** |
| "Is this layout broken?" | **Lint** | none (read-only) | no |

Generate and lint are pure XML operations. **So you can generate and check diagrams without
draw.io installed** — you just can't render them to an image.

## The three scripts

| Script | What it does | Side effects |
|---|---|---|
| `New-Drawio.ps1` | Build `.drawio` from a JSON spec with automatic layered layout | writes a file (needs `-Force` to overwrite) |
| `Export-Drawio.ps1` | Page-by-page export to PNG / SVG / PDF, auto-detecting the draw.io install | writes only under `-OutDir` |
| `Test-DrawioLayout.ps1` | Layout lint for the four defect classes | none (read-only) |

### Typical usage

```powershell
# Generate, then lint immediately
.\scripts\New-Drawio.ps1 -Spec .\arch.json -Out .\arch.drawio -ThenTest

# Lint only
.\scripts\Test-DrawioLayout.ps1 -Path .\arch.drawio

# Export every page (counts pages itself, loops 1-based)
.\scripts\Export-Drawio.ps1 -Path .\arch.drawio -OutDir .\out -Format png -Scale 2

# List pages and show which drawio.exe was found
.\scripts\Export-Drawio.ps1 -Path .\arch.drawio -ListPages
```

The spec format is documented by example in
[`examples/sample-architecture.json`](examples/sample-architecture.json) — a 4-layer,
15-module diagram. Run it once and you'll know how to write your own.

## Measured results

Linting a real, already-shipped two-page architecture diagram:

```
  Page  Id/Name                     Shapes  Containers  Edges  Issues
  ----  --------------------------  ------  ----------  -----  ------
  1     System architecture             17           5     16       3
  2     Product UI mockup               39           0      0       0

  [edge through box] 3 findings
    · edge 'e12' (User service → MySQL) passes through Kafka, Redis
    · edge 'e14' (Order service → MySQL) passes through Kafka
    · edge 'e15' (Payment service → OSS) passes through Kafka, Redis
```

Three edges run from the business-service layer straight down to the data layer, and the
orthogonal router sent them **across the Kafka and Redis boxes in the middleware layer**.
The defect is genuinely visible in the rendered image, but you cannot see it by reading the
`.drawio` XML.

The other page — 39 shapes — produced **zero false positives**, which says the exemptions work:
text-only labels are excluded from overlap checks, full containment counts as intentional
layering, and an edge crossing a dashed layer container is normal.

Auto-layout, meanwhile, measured **0 issues**: 4 layers, 15 modules, 12 edges.

## Safety model

- `Test-DrawioLayout.ps1` **writes nothing**; it is strictly read-only
- `Export-Drawio.ps1` writes only inside `-OutDir` (default `<source dir>\export`) and never
  touches the source file
- `New-Drawio.ps1` **requires an explicit `-Force`** to overwrite an existing file, so a stray
  keystroke can't destroy a diagram you've already tuned
- The draw.io CLI is invoked with `--export`, which does not modify the source `.drawio`

## Limitations (stated plainly, so you don't expect what it can't do)

1. **Text overflow is an estimate.** Real width depends on font, weight and letter spacing, and
   draw.io wraps text automatically. The formula assumes CJK = 1.0×fontSize and
   ASCII = 0.55×fontSize, so it reports *possible* overflow. Anything within ~5% is fine.
2. **Edge-through-box detection honours explicit waypoints; it only approximates when there are
   none.** When an edge carries `<Array as="points">`, the linter uses the real polyline
   (exit anchor → waypoints → entry anchor). Only edges *without* waypoints fall back to the
   "exit bottom → move across at mid-gap → enter top" approximation. So editing the routing does
   change the lint result — the fix-then-reverify loop holds. What it reports is a *real* pass
   through a module. Edge-on-edge crossings are not checked and should not be treated as defects.
3. **Auto-layout divides each layer evenly — it is not a global grid.** Each layer splits the
   available width independently, so box widths and column positions **differ between layers**.
   It looks tidy, but it is not the strict column alignment of a table. For strict alignment you
   need to place things by hand.
4. **No auto-layout for tables, swimlanes or sequence diagrams.** Those work fine through
   hand-written XML → lint → export, just not through the spec generator.

## Installation

This is a public git repository, so it can be used directly as a package source.
No npm registry and no npm account required.

```powershell
# Option 1: install the whole collection (recommended)
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills

# Option 2: mount just this skill (junction, no admin needed)
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\drawio" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\drawio"
```

The skill roots are watched by DSH, so **adding, renaming or removing one needs no restart**.

### Prerequisites

- **Generate and lint**: Windows PowerShell 5.1 (built into Windows), nothing else
- **Export**: draw.io desktop. Install with `winget install JGraph.Draw` or from
  <https://github.com/jgraph/drawio-desktop/releases>

The scripts auto-detect where draw.io lives. Note that detection **cannot rely on the registry's
`InstallLocation`** — measured here, it can be empty. The reliable value is `DisplayIcon`, and its
trailing `,\d+` is an icon index that must be stripped. Detection order:
App Paths → PATH → `InstallLocation` → `DisplayIcon` → common install paths.

## References

| File | Read it when |
|---|---|
| [`references/01-文件格式.md`](references/01-文件格式.md) | You need to hand-write or read mxGraphModel XML, change styles, or handle multi-page and compressed files |
| [`references/02-CLI导出.md`](references/02-CLI导出.md) | You're changing export flags, exporting PDF/SVG, or hitting export errors |
| [`references/03-布局体检.md`](references/03-布局体检.md) | The lint reported something and you want to fix it, or understand the four defect classes |
| [`references/04-脚本维护与踩坑.md`](references/04-脚本维护与踩坑.md) | You're modifying these scripts (the PowerShell 5.1 traps all live here) |

*(The reference documents are written in Chinese.)*

## Licence

[MIT](../../LICENSE) © Aurirlk · original skill (not adapted)
