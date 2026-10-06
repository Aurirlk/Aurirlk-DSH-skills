# ui-use-confirm

> Part of the [Aurirlk DSH Skills](../../README.md) collection · [← back to the index](../../README.md)

**English** | [中文](README.md)

One convention for confirmation dialogs in a Nuxt app, plus a clear answer to **which actions must
confirm first**.

## When to use

- The user asks how to write a delete confirmation or how the confirm dialog works
- **You are about to perform an irreversible action** (delete, clear, overwrite, submit) — those
  deserve a confirmation by default, without being asked

## The options contract

```ts
const { showConfirm } = useConfirm();

showConfirm({
  title: string,
  message: string,
  icon?: string,          // default 'mdi-help-circle'
  confirmText?: string,   // default '确认'
  onConfirm: () => void | Promise<void>
});
```

**Key semantics**: cancelling or dismissing the dialog **never fires `onConfirm`**. Putting side
effects inside `onConfirm` is therefore safe.

## Example

```ts
const { showConfirm } = useConfirm();
const { $tip } = useNuxtApp();

showConfirm({
  title: 'Delete session',
  message: 'Delete this session? This cannot be undone.',
  icon: 'mdi-delete',
  confirmText: 'Delete',
  onConfirm: async () => {
    await store.removeSession(sessionToDelete);
    $tip('Deleted');
  }
});
```

## Minimal implementation

```ts
// composables/useConfirm.ts
export function useConfirm() {
  const state = useState('confirm', () => ({ open: false, opts: null }));
  return {
    state,
    showConfirm(opts) { state.value = { open: true, opts }; },
    // in the dialog component: confirm → state.opts.onConfirm(); cancel → close only, no callback
  };
}
```

## Source & license

Adapted from `data-agent-frontend-nuxt/.cursor/skills/ui-feedback-utils/use-confirm` in
[Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent)
(Apache License 2.0, original author [SmileSnow819](https://github.com/SmileSnow819), PR #485).

Changes made here: **rewritten from a project-internal convention into something standalone**
(minimal implementation and applicability guidance added), frontmatter adapted for DSH, directory
renamed `use-confirm` → `ui-use-confirm`, this README written.
See [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md).