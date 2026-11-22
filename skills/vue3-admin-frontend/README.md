# vue3-admin-frontend

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

后台页面照骨架写，别自创流派。

## 这玩意儿治什么

后端接口改了个字段，前端要跟着动。这种活儿不难，但**漏一处就编译不过，或者过了编译但界面上显示的是 key 原文**。

漏的通常是这几处：类型定义、**每个**语言包文件、`app.d.ts` 里那张手写的类型表、自动路由没重新生成。

这个技能把「后端改了 DTO 前端要动哪七处」排成固定顺序，并且把几个必须靠记忆的约定写死在里面。

## 它要求你跟骨架，不许自创

这套骨架是 SoybeanAdmin 一系：`@sa/axios` 扁平请求、`@elegant-router` 文件路由、`useTable` / `useTableOperate`、Naive UI + UnoCSS。

你可以觉得 `useTable` 不如自己写 composable 灵活。但只要仓里四十个页面都是这个写法，**第四十一个跟着写，以后改起来才是线性的**。技能里凡是标了「约定」的，就是不许用个人偏好覆盖。

## 三个真踩过的坑

**1. i18n 一个 key 要改两类地方，且语言包不止两个**

`src/locales/langs/*.ts` 是"值"——**每个语言一份**，出海项目常见 8 套（中/繁/英/越/泰/印尼/马来/菲律宾），漏一个就是那个语言下显示 key 原文。

`src/typings/app.d.ts` 里的 `I18n.Schema` 是"类型"，那张类型表是**手写的 interface，不会自动生成**（有的项目还有 `extra.d.ts`）。

只加值不加类型 → 运行时能用，但 `vue-tsc` 会在每个用到该 key 的地方报"属性不存在"。反过来只删值不删类型 → 编译不报错，但界面直接显示原始 key 字符串。

**2. `prose` 类在这套骨架里根本不存在**

UnoCSS 默认不带 typography 预设，`prose`、`prose-sm` 写了等于没写。markdown 排版必须走项目里具名的 `markdown-content.vue`。看到"样式没生效"先别怀疑构建，先怀疑这个类压根没定义。

**3. 表格 `columns` 必须是函数**

写成 `columns: [...]` 数组，列表能出来，但列不会随状态更新。正确写法是 `columns: () => [...]`。

## 七步同步顺序（顺序不能倒）

```
读后端 diff → API 层 → 类型 → 页面 → i18n → 路由生成 → typecheck + lint
```

先改页面再改类型，`vue-tsc` 会同时报十几个"属性不存在"，真正的问题被埋掉。

## 什么时候会用到

- 后端加了接口，前端要接上。
- 新增一个管理页面（列表 + 抽屉表单）。
- `vue-tsc` 报 i18n key 类型错。
- 页面样式写了类但不生效。
- 改了路由，刷新就回默认页。

## 安装

```bash
pnpm add github:Aurirlk/Aurirlk-DSH-skills
# 或单挂
ln -s "$PWD/skills/vue3-admin-frontend" ~/.dsh/skills/vue3-admin-frontend
```

## 它不管什么

- 不管后端怎么写接口（那是后端的事，这里只消费）。
- 不管构建配置、部署、CI 流水线。
- 不管设计稿还原度——只管代码结构和约定。

## 相关

- [agent-chat-endpoint](../agent-chat-endpoint/README.md) —— 流式对话的前端那半边（`reader.cancel()` 之后收不到数据这个坑）
- [git-submit-safety](../git-submit-safety/README.md) —— 前端 pre-commit 的 `pnpm fmt` 会把文件重排，钩子必然失败
