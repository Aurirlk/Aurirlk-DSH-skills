---
name: vue3-admin-frontend
description: 用 Vue 3 + Naive UI + UnoCSS + Pinia 这套后台骨架写页面、并跟后端接口变更保持同步时使用。含 API 层扁平请求约定、useTable 列表页、抽屉表单、自动路由、i18n 手写类型表、以及「后端改了 DTO 前端要动哪七处」的顺序。
whenToUse: 后端加了/改了接口要同步前端；新增页面、列表、抽屉表单；TS 报 i18n key 类型错；页面样式用了 prose 类却不生效。
---

# Vue 3 后台前端开发

这套骨架来自 SoybeanAdmin 一系的约定：`@sa/axios` 扁平请求、`@elegant-router` 文件路由、`useTable` / `useTableOperate` 组合式封装、Naive UI + UnoCSS。

**先说一件最重要的事**：这套骨架的"约定"比"最佳实践"重要。你可以觉得 `useTable` 不如自己写 composable 灵活，但只要仓里已有 40 个页面都是这个写法，第 41 个跟着写，改起来才是线性的。所以下面的规则，凡是标了「约定」的，别用个人偏好覆盖。

## 技术栈基线

| 层 | 技术 |
| --- | --- |
| 框架 | Vue 3.5+，`<script setup>` Composition API |
| 语言 | TypeScript 5.9+，strict |
| 构建 | Vite 7+，pnpm monorepo |
| 组件 | Naive UI（`n-` 前缀） |
| 样式 | UnoCSS（presetWind3）+ SCSS |
| 状态 | Pinia（Composition API 风格） |
| 路由 | Vue Router + `@elegant-router/vue` 文件路由 |
| HTTP | Axios 封装成 `createFlatRequest` |
| i18n | vue-i18n |
| 检查 | Oxlint + ESLint + `vue-tsc` |

## 目录与命名（约定，别改）

```
src/
├── views/<domain>/          页面，按业务域分目录
├── service/api/<domain>.ts  API 函数，一个域一个文件
├── service/request/         HTTP 封装
├── components/{common,custom,advanced}/
├── hooks/{common,business}/
├── store/modules/           Pinia
├── router/elegant/          自动生成，禁止手改
├── typings/api/             declare namespace Api
├── locales/langs/           zh-cn.ts / en-us.ts
└── styles/ theme/ utils/
```

| 类型 | 规则 | 例 |
| --- | --- | --- |
| 组件文件 | kebab-case | `operate-drawer.vue` |
| TS 模块 | kebab-case | `use-table.ts` |
| 组件 name | PascalCase，`defineOptions` | `defineOptions({ name: 'AuthAvatar' })` |
| API 函数 | `fetch` + PascalCase | `fetchAgentList` |
| Store | `use` + PascalCase + `Store` | `useAuthStore` |
| Composable | `use` + PascalCase | `useTableOperate` |
| 类型 | PascalCase 点分命名空间 | `Api.Agent.AgentItem` |

## API 层：扁平请求，不抛异常

```ts
import { request } from '../request';

export function fetchXxxList(params?: { page?: number; size?: number; keyword?: string }) {
  return request<Api.Xxx.XxxList>({ url: '/xxx/page', params });
}

export function fetchCreateXxx(data: Api.Xxx.CreateRequest) {
  return request<Api.Xxx.XxxItem>({ url: '/xxx', method: 'post', data });
}
```

**关键约定：返回 `{ data, error }`，先看 `error` 再用 `data`。**

```ts
const { data, error } = await fetchXxxList({ page: 1 });
if (error) return;          // 或交给上层统一提示
// 这里 data 才可信
```

不要包 `try/catch` 兜 axios 异常——这个封装已经把异常转成 `error` 字段了。包了会写出一堆永远进不去的 catch，还让人误以为有兜底。

**流式（SSE）不走 axios**：用原生 `fetch` + `ReadableStream.getReader()`。axios 在浏览器里拿不到增量 body。

## 列表页：`useTable` + `useTableOperate`

```vue
<script setup lang="tsx">
import { useTable, useTableOperate } from '@/hooks/common/table';
import { fetchXxxList, fetchDeleteXxx } from '@/service/api/xxx';

const { columns, data, getData, loading, pagination } = useTable({
  apiFn: fetchXxxList,
  columns: () => [
    { key: 'name', title: '名称' },
    { key: 'status', title: '状态', render: row => <NTag>{row.status}</NTag> },
    {
      key: 'operate',
      title: '操作',
      render: row => (
        <div class="flex gap-8px">
          <NButton onClick={() => handleEdit(row)}>编辑</NButton>
          <NButton onClick={() => handleDelete(row.id)}>删除</NButton>
        </div>
      )
    }
  ]
});

const { drawerVisible, editingData, handleAdd, handleEdit } = useTableOperate(data, getData);
</script>
```

三条容易踩的：

1. **`columns` 必须是 `() => [...]`**，不能是数组字面量。写成数组，列在需要随状态变化时不会更新。
2. **用 JSX 渲染列 → `<script setup lang="tsx">`**。写成 `lang="ts"` 会报"找不到 JSX 命名空间"。
3. 表格里的状态值别散着写 `row.status === 1 ? '启用' : '停用'`，仓里有 `render` 字典和枚举就用它，否则新增状态时会漏改。

## 表单：抽屉，不是弹窗

```vue
<NDrawer v-model:show="visible" :width="500">
  <NDrawerContent title="标题" closable>
    <NForm ref="formRef" :model="formData" :rules="rules"><!-- 表单项 --></NForm>
    <template #footer>
      <NButton @click="visible = false">取消</NButton>
      <NButton type="primary" @click="handleSubmit">确定</NButton>
    </template>
  </NDrawerContent>
</NDrawer>
```

字段多（>8 个）用抽屉；只是确认用 `n-popconfirm` / `n-dialog`，别为两行字开个抽屉。

## 路由：文件即路由

新增页面后在仓库根跑：

```bash
pnpm gen-route
```

**不要手改 `src/router/elegant/` 下的任何文件**——那是生成产物，下次生成就没了。要改 meta 就在页面文件对应的路由配置里改：

```ts
{
  title: 'pageName',
  i18nKey: 'route.pageName',
  icon: 'mdi:icon-name',
  order: 10,
  roles: ['1'],
  keepAlive: true,
  hideInMenu: false
}
```

## 类型：`declare namespace Api`

```ts
declare namespace Api {
  namespace Xxx {
    interface XxxItem { id: number; name: string }
    type XxxList = Api.Common.PaginatingResponse<XxxItem>;
  }
}
```

放 `src/typings/api/`，新增文件记得在 `index.d.ts` 里补 barrel export，否则全局 `Api.Xxx` 找不到。

## i18n：语言包 + 手写类型表，两类地方都要改

所有用户可见文本走 `$t('key')`。新增一个 key 要改的是**两类地方**：

1. **全部语言包**（`src/locales/langs/*.ts`）。数量按项目实际——出海项目常见 8 套（中/繁/英/越/泰/印尼/马来/菲律宾），**缺一个就是那个语言下界面显示 key 原文**。
2. **手写的类型表**：`src/typings/app.d.ts` 里的 `I18n.Schema`；有的项目还有 `src/typings/extra.d.ts`（页面级 key）。

第 2 类是这套骨架最容易漏的地方：locale 文件是对象，类型表是手写的 interface。只加值不加类型，运行时能用，但 **`vue-tsc` 会在所有用到该 key 的地方报"不存在此属性"**。类型表不是自动生成的，别指望它能自己长出来。

> 反过来也成立：删 key 时两边一起删。只删值留下类型，编译器不报，但运行时会显示原始 key 字符串，测试阶段很难注意到。

🔴 **排查时必须按 key 名搜，不能按键值搜**：

```bash
grep -rn "route.dataAgent" src/locales/langs/   # ✅ 命中所有语言包
grep -rn "数据智能体" src/locales/langs/          # ❌ 只命中 zh-cn，漏掉另外 7 个
```

只有 zh-cn 用中文，其余语言里同一 key 是英文/越南语/泰语。所以"我 grep 过了，只有一处"这种判断在改文案时**一定错**。

## 样式

- **优先 UnoCSS 工具类**：`flex gap-16px text-primary h-full justify-between`
- **Naive UI 变量**：`var(--n-*)`，别硬编码颜色
- **穿透组件**：`<style scoped lang="scss">` + `:deep(.n-xxx)`
- **暗黑模式**：`html.dark` class 控制，别自己写媒体查询

🔴 **UnoCSS 没有 typography 预设，`prose*` 类全部无效**。markdown 渲染的排版必须走项目里的 `markdown-content.vue`（或同类组件）里的具名样式。写了 `prose prose-sm` 却"没反应"，不是加载失败，是这个类压根不存在。

## 后端变更 → 前端要动的七处

后端改了接口，按这个顺序走，别跳：

1. **读后端 diff**：新增/改了哪些 `@RequestMapping` / `@GetMapping` / `@PostMapping`，DTO/VO 字段变了什么，返回的 `Result<T>` 里 T 是什么。
2. **API 层** `service/api/<domain>.ts`：新增 `fetch*`、改 URL/方法/参数、删废弃函数。
3. **类型** `typings/api/`：字段类型跟 DTO 对齐，补 barrel export。
4. **页面** `views/<domain>/`：新增目录；字段变更改 columns 与表单；状态枚举变更改 render。
5. **i18n**：全部语言包 + `app.d.ts`（+ 有的项目 `extra.d.ts`）。
6. **路由**：新增页面跑 `pnpm gen-route`。
7. **验证**：
   ```bash
   pnpm typecheck && pnpm lint
   ```

**顺序不能倒**：先改页面再改类型，`vue-tsc` 会同时报十几个"属性不存在"，把真正的问题埋掉。

## 坑表

| 现象 | 真因 | 处理 |
| --- | --- | --- |
| `vue-tsc` 报 i18n key 不存在 | 只加了语言包没加 `I18n.Schema` | 手写类型表，见上 |
| 表格列不随状态更新 | `columns` 写成了数组不是函数 | 改成 `() => [...]` |
| JSX 报命名空间错 | `<script setup lang="ts">` | 改 `lang="tsx"` |
| `prose` 类没效果 | UnoCSS 无 typography 预设 | 用 `markdown-content.vue` |
| store 初始化时 `undefined` | 顶层调 `useOtherStore()` | 移到 setup 函数内部调用 |
| 改了路由刷新就没了 | 手改了 `router/elegant/` | 只能改源配置 + 重新生成 |
| 页面能跑但 CI 挂 | 只跑了 dev，没跑 `typecheck` | 提交前两条命令都跑 |
| 某个语言下显示 key 原文 | 漏了那个语言包 | 按 key 名搜全部语言包（不是按键值） |

## 交付自检

- [ ] `pnpm typecheck` 通过（不是"dev 能开就行"）
- [ ] `pnpm lint` 通过
- [ ] 新增/改动的可见文本都有 `$t()`，**全部**语言包与 `app.d.ts`（+ `extra.d.ts`）都改了
- [ ] 新增页面跑过 `pnpm gen-route`
- [ ] 没手改 `router/elegant/`
- [ ] 列表页 `columns` 是函数、tsx 文件用 `lang="tsx"`
- [ ] 没有硬编码颜色 / 中文串 / 接口 URL
