# prompt-architect

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

A senior AI prompt architect. Turns vague requests into copy-ready Markdown prompts — and explains why each technique is there, plus which model to run it on.

## When to use

- "Optimise this prompt: ..."
- "Write me a prompt for an XX assistant"
- Your prompt produces unstable output and you want to know which constraints are missing, or whether CoT / few-shot would help

## What it does

1. **Diagnose**: identify missing context, goals, audience and constraints (analysis only, not output).
2. **Generate**: produce a prompt following Role / Profile / Context / Goals / Input Data / Output Format / Constraints / Skills / Workflow / Examples, ready to copy from a code block.
3. **Teach**: briefly explain the techniques used (why CoT, why a negative constraint), concisely but without hand-waving.
4. **Recommend**: one to three suitable models with reasons.

## vs. prompt-consultant-master

| | This skill | prompt-consultant-master |
|---|---|---|
| Input | An existing prompt or a clear request | A vague idea only |
| Interaction | Delivers directly | Multi-turn interview, max 2 questions per turn, delivers after the profile is confirmed |
| Focus | Structure and technique teaching | Eliciting requirements, removing "AI voice", guarding negative boundaries |

## Usage

```
Optimise this prompt: you are an assistant, help me write articles
```

```
Write a prompt for turning technical docs into product release notes. No jargon.
```

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

See the [collection index](../../README.en.md#installing-a-single-skill) to install only this one.

## Boundaries

- Delivers the prompt and notes; it does not execute the prompt unless you explicitly ask.
- Never invents model capabilities — uncertain claims are marked "needs testing".
