# speak-human

> Part of [Aurirlk DSH Skills](../../README.md) · [← Back to index](../../README.md)

[中文](README.md) | **English**

Translate engineer-speak into **plain business language** that non-technical readers understand at a glance.

The output is "here's what it does and what problem it solves", not "here's how the code changed".

## When to use

- Turning technical docs / commit logs / Git history / requirements into **product introductions** or **release notes** for stakeholders, customers, or management
- When output is criticised as "too technical", "unreadable", or "full of jargon"
- When the user literally asks to "speak human"

## The tension it holds

| Extreme | Requirement |
|---|---|
| **Never use jargon** | Assume the reader knows nothing about code, databases, APIs, or architecture. Describe behaviour and outcomes, not implementation |
| **Never write marketing filler** | Objective, restrained, plain. No stacked adjectives |

Most "plain language" attempts collapse into the second failure — **jargon removed, replaced by empty phrases**, which is equally unacceptable.

## Three-step pipeline

```
1 Denoise & merge  → fold related changes into one business description; drop or collapse pure internal work
2 Translate        → apply the formula: [scenario] + [what it does] + [concrete result]
3 Blocklist sweep  → scan both banned-word lists character by character, replace every hit
```

## Translation formulas

- **New feature**: `[scenario] + [what it does] + [concrete result]`
- **Bug fix**: `Fixed an issue where [symptom] occurred during [scenario]`

## Jargon downgrade examples

| Term | Plain version |
|---|---|
| serialisation | reading data |
| enum / field | option / input field |
| routing | page navigation |
| authentication | permission check |
| async queue | background processing |
| failover | switching to a backup line when the main service fails |
| hybrid RAG retrieval | searching by both keywords and meaning |

**Keepable proper nouns**: MySQL, Excel, OCR, URL — but explain the purpose in plain words on first use.

## Blocklist

Two built-in banned-word lists covering the two most common failures:

**Engineering jargon**: 赋能, 抓手, 闭环, 生态, 矩阵, 链路, 颗粒度, 沉淀, 对齐, 打通, 降本增效, 底层逻辑, 痛点, 兜底, 契约层, 高可用, 异构, 落库, 回灌

**Marketing filler**: 致力于, 旨在, 无缝衔接, 革命性, 颠覆性, 突破性, 全方位, 一站式, 显著提升, 极大的, 重磅推出, 焕然一新, 保驾护航

The draft must be scanned before delivery; every hit is replaced with a concrete verb or noun.

## Before and after

**Technical**

> Model management supports SM4-encrypted key storage, enable/disable, scoping, and multi-model circuit-breaker failover; the candidate chain is ordered by default priority and switches to the next provider on failure.

**Plain**

> Keys are stored with strong encryption. You can configure several backup models; if the primary model has network issues or a service outage, the system switches to a backup automatically so the service stays up.

## Output templates

- **Product introduction**: grouped by module, each item = capability phrase + plain description
- **Release notes**: `Improvements` / `Fixes` sections; fixes must keep both the scenario and the symptom

## Install

See the [installation section of the repo README](../../README.md#怎么装).

## Origin and license

Original method write-up; examples drawn from real project iteration records.
