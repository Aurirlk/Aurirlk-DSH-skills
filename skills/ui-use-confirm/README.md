# ui-use-confirm

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

统一 Nuxt 项目里确认弹窗的调用规范，并明确**哪些操作必须先二次确认**。

## 什么时候用

- 用户问「删除确认怎么写」「确认弹窗怎么用」
- **你即将执行不可逆操作**（删除、清空、覆盖、提交）——这类操作**默认就该确认**，不用等人提醒

## 参数契约

```ts
const { showConfirm } = useConfirm();

showConfirm({
  title: string,
  message: string,
  icon?: string,          // 默认 'mdi-help-circle'
  confirmText?: string,   // 默认 '确认'
  onConfirm: () => void | Promise<void>
});
```

**关键语义**：取消或关闭弹窗时**不会触发 `onConfirm`**。所以把副作用放在 `onConfirm` 里是安全的。

## 示例

```ts
const { showConfirm } = useConfirm();
const { $tip } = useNuxtApp();

showConfirm({
  title: '删除会话',
  message: '确定要删除这个会话吗？此操作不可恢复。',
  icon: 'mdi-delete',
  confirmText: '确定删除',
  onConfirm: async () => {
    await store.removeSession(sessionToDelete);
    $tip('删除成功');
  }
});
```

## 最小实现

```ts
// composables/useConfirm.ts
export function useConfirm() {
  const state = useState('confirm', () => ({ open: false, opts: null }));
  return {
    state,
    showConfirm(opts) { state.value = { open: true, opts }; },
    // 弹窗组件里：确认 → state.opts.onConfirm(); 取消 → 只关窗，不调回调
  };
}
```

## 来源与许可

二开自 [Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent) 的
`data-agent-frontend-nuxt/.cursor/skills/ui-feedback-utils/use-confirm`（Apache License 2.0，
原作者 [SmileSnow819](https://github.com/SmileSnow819)，PR #485）。

本仓库的改动：**从项目内部约定改写为独立可用**（补上最小实现与适用判据）、
frontmatter 适配 DSH、目录名 `use-confirm` → `ui-use-confirm`、补写本 README。
详见 [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md)。