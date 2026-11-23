# chinese-text-proofreader

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

A senior Chinese proofreading and polishing expert. Gives a before/after table, the reason for each change, and a clean final draft — typos marked in red, faulty sentences in green.

## When to use

- You want typos, punctuation errors or grammatical faults found in a Chinese text
- A sentence is long and awkward and you want one or two more natural rewrites
- You need a before/after table to explain changes to an author or colleague

## What it does

1. Greets the user and recommends **no more than 500 characters at a time**.
2. Diagnoses each sentence: structure, subject-verb-object agreement, word accuracy.
3. Outputs a Markdown table: original / revised / error type / reason.
4. Offers advanced rewrites for long sentences that are grammatical but unclear.
5. Ends with the complete final draft in a blockquote.

Every change preserves the author's meaning; no core information is added or dropped.

## Usage

```
Proofread this copy: ...
```

```
This paragraph reads awkwardly. Please polish it.
```

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

See the [collection index](../../README.en.md#installing-a-single-skill) to install only this one.

## Boundaries

- Recommended input is under 500 characters at a time; longer text is handled in batches.
- Language-level proofreading only — no fact-checking; domain-specific terminology needs the user's own confirmation.
