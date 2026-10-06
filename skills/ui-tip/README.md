# ui-tip

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

统一 Nuxt 项目里全局 Toast 的调用规范。**成功走默认、错误必须显式指定 icon** —— 这条规则能消掉
一大类"错误提示长得跟成功一样"的 UI 事故。

## 什么时候用

- 用户问「提示怎么写」「Toast 怎么用」「复制成功要不要弹提示」
- **你写代码时准备给用户一个成功 / 失败 / 警告 / 信息提示**（这条更重要——不用等人问）

## 调用规范

```js
const { $tip } = useNuxtApp();

$tip(message, { color, icon, timeout })   // 签名

$tip('操作成功');                                        // 成功：全默认
$tip('保存失败', { color: 'error', icon: 'mdi-error' });  // 错误：必须手动指定
$tip('正在生成报告...', { color: 'info', timeout: 5000 }); // 自定义色/超时
```

| 场景 | color | icon | timeout |
|---|---|---|---|
| 成功 | `success`（默认） | `mdi-check`（默认） | 3000（默认） |
| **错误** | `error` | **必须手动传 `mdi-error`** | — |
| 其它 | 手动传 | 非 error 时可不传 | 可选 |

`timeout: -1` = **永不自动关闭**，需用户手动点右上角关闭。

## 最小实现

如果你的项目还没有 `$tip`，用 Nuxt plugin 注入即可：

```js
// plugins/tip.client.js
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide('tip', (message, opts = {}) => {
    const { color = 'success', icon = 'mdi-check', timeout = 3000 } = opts;
    // 接你项目的 snackbar 实现（Vuetify: useSnackbar / vuetify-sonner 等）
    showSnackbar({ text: message, color, icon, timeout });
  });
});
```

## 来源与许可

二开自 [Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent) 的
`data-agent-frontend-nuxt/.cursor/skills/ui-feedback-utils/tip`（Apache License 2.0，
原作者 [SmileSnow819](https://github.com/SmileSnow819)，PR #485）。

本仓库的改动：**从项目内部约定改写为独立可用**（原文假定 `$tip` 已存在，现补上最小实现）、
frontmatter 适配 DSH、目录名 `tip` → `ui-tip`、补写本 README。
详见 [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md)。