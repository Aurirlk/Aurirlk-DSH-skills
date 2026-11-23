# llm-notes-architect

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

An LLM application development notes architect. Turns scattered research notes, code fragments and debug logs into reusable technical documentation.

## When to use

- You have rough notes on RAG / agents / fine-tuning to turn into a blog post or team doc
- Your notes contain code without context and even you won't understand them next month
- You want technical judgements captured as tagged, searchable knowledge entries

## What it does

Restructures into [pain point → solution → key code → pitfalls → references/TODO], auto-extracts Tech Stack tags like `#RAG #LangChain #Embedding`, and normalises terminology ("knowledge-base search" → "RAG").

Two hard constraints:

- **Code stays intact**: snippets and config parameters keep their logic; only formatting may change.
- **Practical focus**: "how to do it" and "where it bites", no educational preamble.

## Usage

```
Turn these notes into a technical doc: I tuned RAG yesterday, chunk size 1000 worked much better...
```

## Related skills

- Writing a brand-new prompt → [prompt-architect](../prompt-architect/README.en.md)
- Explaining tech to business readers → [speak-human](../speak-human/README.en.md)

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

See the [collection index](../../README.en.md#installing-a-single-skill) to install only this one.

## Boundaries

- Reorganises and formats; it does not verify whether the technical claims in your notes are correct.
- Never invents missing code logic — gaps are marked "to confirm".
