# agent-chat-endpoint

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

A streaming chat endpoint looks trivial: emit tokens, emit a done frame. **What breaks in production is never those two things.**

What breaks: newlines swallowed, spinner still spinning after the answer, zero history saved, and context blowing up mid-conversation. Four subsystems, four different root causes.

## When to use

- Building or fixing an agent's streaming chat endpoint (SSE / typewriter)
- **Text collapses into one paragraph, tables and headings disappear**
- **Spinner keeps spinning 2–3s after the answer finished**
- **Chat works, but history is always empty**
- Long sessions degrade, or compression drops the most recent turns
- One endpoint returns audio on success and JSON on failure, and the client breaks

## The four pieces

```
1. Delta mapping   → whitespace-only frames are content; don't filter with isBlank
2. Completion      → extra model calls belong on a separate endpoint, never at stream tail
3. Persistence     → read the auth context on the request thread; never let DB failure break chat
4. Context budget  → bound by message id; compression must not rewrite history
```

The symptom → diagnosis table in [SKILL.md](SKILL.md) can be used directly against a live incident.

## Three counter-intuitive rules

1. **`isBlank()` silently kills markdown.** The model emits `"\n"` as its own frame; dropping it as "empty" removes every block-level rule.
2. **Doing work after `completion` means it never happens.** The client calls `reader.cancel()` on the done frame; put it before and you delay completion instead.
3. **`doFinally` has no auth context.** The SSE writer is not the request thread — the #1 cause of "no history saved".

## ⚠️ Boundaries

- Targets **self-hosted** chat endpoints (SSE / chunked). Hosted provider protocols are out of scope.
- Framework-agnostic; examples lean Java + Vue.
- "Compression" here means **prompt budget**, not vector-retrieval long-term memory (see `agent-orchestration`).

## Usage

```
Our streaming chat renders no tables. Check the delta mapping.
```

```
The spinner runs two extra seconds after the answer. What is that?
```

## Platform

None. Rules are language-independent; snippets are Java (Spring) + Vue 3.
