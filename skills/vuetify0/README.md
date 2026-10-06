# vuetify0

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

[`@vuetify/v0`](https://0.vuetifyjs.com/) 的使用与编写指南——**Vue 3 的无样式（headless）逻辑层**。
组件只管逻辑、不带任何样式，所以它能接进任何设计系统。

## 什么时候用

**在写自定义逻辑之前，先查 v0 有没有现成的。** 这个技能的核心价值就是那张对照表：

| 你需要 | 用 v0 的 |
|---|---|
| 单选 | `createSingle` |
| 多选 | `createSelection` |
| 带「全选」的选择 | `createGroup` |
| 分步向导 / 轮播 | `createStep` |
| 表单校验 | `createForm` |
| 跨层共享状态 | `createContext` |
| 浏览器 / DOM 工具 | v0 utilities |

**尤其注意这些「别自己造」的场景**：原生 `<button>`、自造 `setTimeout` 计时器、
自造弹层 / dialog —— 对应的是 `Button`、`useTimer`、`Dialog`/`Popover`/`useStack`。

## 配套文档（按需加载）

```
references/
├── REFERENCE.md             完整 API 参考
├── selection-patterns.md    选择模式（单选/多选/分组/分步）
├── component-examples.md    组件用法示例
├── anti-patterns.md         反模式
├── layer-decisions.md       分层决策
└── authoring-guide.md       编写自定义 v0 组件的规范
```

## 安装

```bash
pnpm add @vuetify/v0
```

无需全局插件，按需 import：

```ts
import { createSelection } from '@vuetify/v0/composables'
import { Tabs } from '@vuetify/v0/components'
```

## 来源与许可

**取自官方 skill**：[`vuetifyjs/0`](https://github.com/vuetifyjs/0) 的 `skills/vuetify0/`
（MIT License，Copyright © 2016-now Vuetify, LLC）。

本仓库的改动：仅 frontmatter 适配 DSH（`description` 改双语、新增 `whenToUse`）、补写本 README。
正文与 `references/` 保持官方原样（**这份副本比 DataAgent 里那份完整**——那边只有 3.9 KB 的
删减版且丢了全部 references）。

官方文档：<https://0.vuetifyjs.com/> · 官方 skill 页：<https://agentskills.so/skills/vuetifyjs-0-vuetify0>