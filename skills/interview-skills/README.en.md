# interview-skills

> Part of the [Aurirlk DSH Skills](../../README.md) collection · [← back to the index](../../README.md)

**English** | [中文](README.md)

**An AI mock interviewer for big-tech interviews.** Give it a target company, role and job
description plus your resume, and the agent role-plays **the interviewer for that role at that
company** — not a generic question bank, but the questions that JD and that resume actually invite,
with the follow-ups they deserve.

## When to use

- The user is preparing for interviews or wants a mock interview
- They want questions for **a specific company and role**, not "common interview questions"
- They want to practise the **HR round**, **salary negotiation** or "why did you leave"
- They want a **multi-round** simulation (round one into round two into round three, with context)

## What it produces

| Output | Notes |
|---|---|
| **10 interview questions** | Each with **difficulty**, **answer hints** and **follow-up directions** |
| **Good vs bad answers** | Two answers to the same question, so the gap is visible |
| **HR round module** | Leaving a job, career plans, salary expectations |
| **Salary negotiation script** | Concrete phrasing for offer negotiations |
| **Multi-round simulation** | Rounds one/two/three chained together with context |

## Companies covered

Alibaba, Tencent, ByteDance, Baidu, Meituan, JD, Huawei, Didi, Pinduoduo, plus Google, Meta,
Amazon (including AWS) and Microsoft.

## Bundled references (loaded on demand)

```
references/
├── company-profiles.md              interview style and preferences per company
├── jd-parser.md                     parsing a JD down to what it really asks for
├── resume-parser.md                 extracting claims from a resume that can be challenged
├── question-design.md               question design methodology
├── bei-framework.md                 the BEI (behavioural event interview) framework
├── chatbox-senior-ai-chatbot.md     designing a conversational interviewer
└── github-similar-repos-research.md survey of comparable projects
```

## Example

```
I'm interviewing for an AI application engineer role at Alibaba.
JD: <paste the JD>
My resume is resume.pdf.
Start with 10 questions, each with difficulty and follow-up directions.
```

Or:

```
Run a full HR round, focusing on why I left my last job and my career plans.
```

## Installation

See the [installation section of the repository README](../../README.en.md#installation).

## Source & license

Adapted from [`jennifer88huang/interview-skills`](https://github.com/jennifer88huang/interview-skills)
(362 stars). The author declares **MIT License** in the README and badge — "fully open-source under
the MIT license and free to use" — but the repository **has no `LICENSE` file**.

Changes made here: frontmatter adapted for DSH (bilingual `description`, added `whenToUse`, removed
OpenClaw/Claude-specific fields such as `metadata.openclaw` and `allowed-tools`), and this README
written. The body and `references/` are unchanged.
See [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md).