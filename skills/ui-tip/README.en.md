# ui-tip

> Part of the [Aurirlk DSH Skills](../../README.md) collection · [← back to the index](../../README.md)

**English** | [中文](README.md)

One convention for global toasts in a Nuxt app. **Success uses the defaults; errors must set the
icon explicitly** — that single rule removes a whole class of "the error toast looks identical to
the success toast" UI bugs.

## When to use

- The user asks how to write a toast, how `$tip` works, or whether a copy action should notify
- **You are about to surface a success / error / warning / info message** — this one matters more,
  and it does not wait to be asked

## The convention

```js
const { $tip } = useNuxtApp();

$tip(message, { color, icon, timeout })   // signature

$tip('Saved');                                          // success: all defaults
$tip('Save failed', { color: 'error', icon: 'mdi-error' }); // error: explicit
$tip('Generating report...', { color: 'info', timeout: 5000 });
```

| Case | color | icon | timeout |
|---|---|---|---|
| Success | `success` (default) | `mdi-check` (default) | 3000 (default) |
| **Error** | `error` | **`mdi-error` — you must pass it** | — |
| Others | pass explicitly | optional when not an error | optional |

`timeout: -1` means **never auto-close**; the user dismisses it manually.

## Minimal implementation

If your project has no `$tip` yet, inject one with a Nuxt plugin:

```js
// plugins/tip.client.js
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide('tip', (message, opts = {}) => {
    const { color = 'success', icon = 'mdi-check', timeout = 3000 } = opts;
    // wire this to your snackbar implementation (Vuetify useSnackbar, vuetify-sonner, ...)
    showSnackbar({ text: message, color, icon, timeout });
  });
});
```

## Source & license

Adapted from `data-agent-frontend-nuxt/.cursor/skills/ui-feedback-utils/tip` in
[Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent)
(Apache License 2.0, original author [SmileSnow819](https://github.com/SmileSnow819), PR #485).

Changes made here: **rewritten from a project-internal convention into something standalone**
(the original assumed `$tip` already existed; a minimal implementation was added), frontmatter
adapted for DSH, directory renamed `tip` → `ui-tip`, this README written.
See [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md).