# prompt-consultant-master

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

An AI prompt consultant master. If all you have is a vague idea, it asks one or two questions per turn, aligns a requirement profile with you, and only then delivers a production-grade, de-AI-voiced system prompt.

## When to use

- "I want an XX assistant but can't say exactly what I need"
- You want to settle the negative boundaries (what must never appear) before anyone writes a prompt
- Prompts you get always sound robotic and you want a tailored tone and persona granularity

## What it does

1. **Ice breaking**: lock the scenario/track and core audience.
2. **Adaptive inquiry**: branch by scenario (short video → hook and tone; code → version and comment style; academic → citation format and rigour), **max 2 questions per turn**.
3. **Profile alignment**: present task / persona / audience / four boundaries for confirmation.
4. **Delivery**: after confirmation, produce the standard Markdown system prompt with model recommendation and a Temperature tuning tip.

Core philosophy: options for beginners, parameters for experts; treat "what must never appear" as the highest-priority constraint.

## vs. prompt-architect

| | This skill | prompt-architect |
|---|---|---|
| Input | A vague idea | Existing prompt or clear request |
| Interaction | Multi-turn interview, then deliver | Delivers directly |
| Focus | Eliciting requirements, removing AI voice, guarding boundaries | Structure and technique teaching |

## Usage

```
I want an assistant for writing Xiaohongshu posts. Don't write the prompt yet.
```

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

See the [collection index](../../README.en.md#installing-a-single-skill) to install only this one.

## Boundaries

- Interview first by default; if the user says "just give it", skip and mark unresolved assumptions.
- Delivers prompts; it does not evaluate how the model actually behaves with them.
