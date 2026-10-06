# create-interviewer

> Part of the [Aurirlk DSH Skills](../../README.md) collection · [← back to the index](../../README.md)

**English** | [中文](README.md)

**Distil an interviewer into a continuously-evolving AI persona.** Import that interviewer's
public material — transcripts, job descriptions, papers, repositories — and it produces three
things:

| Artefact | Contents |
|---|---|
| **TechMap** | Their technical map: which stacks they care about, and how deep |
| **BehaviorArchive** | How they follow up, when they apply pressure, what signals satisfy them |
| **Persona** | Questioning style, tone, what they fixate on |

The persona then **keeps evolving** — each time you debrief a real interview, the new observations
are merged in.

## When to use

- You want a persona built from a specific interviewer's public material
- You want to debrief an interview you already sat (especially the parts that stumped you)
- You want an interviewer that **keeps pressing on your weak spots** rather than producing a
  one-shot question list

## Workflow (stages in `prompts/`)

```
intake.md              entry point: gather material
  ├─ techmap_analyzer.md   → techmap_builder.md   analyse → build the tech map
  ├─ behavior_analyzer.md  → behavior_builder.md  analyse → build the behaviour archive
  └─ persona_analyzer.md   → persona_builder.md   analyse → build the persona
correction_handler.md  correcting a wrong read
merger.md              merging new observations into an existing persona
techprofiles.md        technical profile template
```

Supporting scripts in `tools/`:

| Script | Purpose |
|---|---|
| `skill_writer.py` | Writes the generated persona out as a skill |
| `social_parser.py` | Parses public material |
| `version_manager.py` | Persona versioning (enables evolution) |

## Dependencies

`requirements.txt` (Python). Before first use:

```bash
pip install -r requirements.txt
```

## Installation

See the [installation section of the repository README](../../README.en.md#installation).

## Source & license

Adapted from [`Bughouse1024/interviewer-skill`](https://github.com/Bughouse1024/interviewer-skill)
(**MIT License**, author Bughouse1024). The skill's `name` stays `create-interviewer` and the
directory matches it.

Changes made here: frontmatter adapted for DSH (bilingual `description`, added `whenToUse`, removed
Claude/Codex-specific fields such as `allowed-tools`, `argument-hint` and `version`), and this
README written. The body, `prompts/` and `tools/` are unchanged.
See [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md).