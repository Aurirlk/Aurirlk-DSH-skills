# 抽取能力与失真点（逐语言）

这套工具用的是 regex 级抽取，不解析语法树、不做类型推断。**这不是省事，是刻意**：
要做到零依赖、任何装了 node 的机器都能跑、几秒内扫完十万行。代价是下面这些失真点，
写手册时必须在正文里标出来，不能让读者以为索引是编译器给的答案。

## 通用置信度口径

| 边类型 | 置信度 | 依据 |
|---|---|---|
| `import` / `require` / `from x import` | high | 语法结构，字符串字面量 |
| 组件使用（`<FooBar />`） | high | 模板里的标签名 |
| 类型继承（`extends` / `implements`） | high | 声明行 |
| "谁引用了这个名字" | medium | 名字匹配，同名会撞 |
| "它调用了谁" | medium | 只认 `名字(` 形式 |
| 端点路径 | high / 需确认 | 字面量直接取；常量表达式递归解析，失败则标 `resolved:false` |

**medium 一律不能当结论用**，只能当线索。手册里凡是引用 medium 的推断，都要写"需按类型确认"。

## Java / Kotlin

**能拿到**：包名、类/接口/枚举/record 及其继承关系、方法名与参数个数、构造器、`@RestController` 的端点（含类级 base path 常量解析）、`@Entity`/`@TableName` 的实体、`@ConfigurationProperties` / `@Value` 的配置键、`String CONST = "..."` 常量（含接口里的隐式常量）。

**会失真**：

- **重载**合并成多条同名符号，`callees` 会挑第一条。同一类里有 3 个 `save` 方法时，答案可能不是你以为的那个。
- **接口方法**在实现类里只有一个 `@Override` 声明，`callees` 从接口追不到实现。
- **同包引用不写 import**，所以调用方只出现在 medium 里。这是 Java 的语言特性，不是索引漏了。
- **Lombok** 生成的 getter/setter/builder 不存在于源码里，索引里就没有。看到 `getXxx` 解析不到定义是正常的。
- **常量来自依赖包**（不在仓库内）时解析不出来，端点会显示 `<NAME>`。
- **继承来的端点**：`@RequestMapping` 在父类或接口上时，子类的路径前缀可能取不到。
- 泛型具体化、`var` 推断、方法引用（`Foo::bar`）全都不认。

## TypeScript / JavaScript

**能拿到**：import / require / 动态 import、导出的函数/类/接口/类型/枚举/常量、顶层箭头函数、类方法、JSX 里的大写组件引用。

**会失真**：

- **动态 import 的路径**是字符串，能拿到路径但拿不到运行时行为（比如 `import(`./views/${name}`)` 会失败）。
- **`export { a as b }`** 只当作再导出，不建立别名映射。
- **装饰器**注入的成员看不见（NestJS 的 `@Inject`、Angular 的 `@Input`）。
- **同名不同文件**极常见（`index.ts` 到处都是），`refs` 会一起列出来。
- **TS 的路径别名**必须能从 `tsconfig.json` 的 `paths` 里读到；读不到时退化成 `@/`、`~/` → `src/` 的约定猜测。
- 打包产物（单行几十万字符）会被跳过，`stats` 里会写跳过了几个。

## Vue / Svelte

**能拿到**：`<script>` 块里的符号（行号按块偏移校正过）、`<template>` 里的大写组件标签、`defineProps` / `defineEmits` / `defineExpose` 的存在与内联类型。

**会失真**：

- **kebab-case 组件**（`<user-avatar-ball />`）不会映射到 `UserAvatarBall.vue`——只有大写标签才会。自动导入（unplugin-vue-components）的组件在模板里可能是 kebab 形式，这类引用会丢。
- `defineProps` 的类型如果来自外部文件（`defineProps<Props>()` 且 `Props` 在别的文件），只记到类型名，不展开。
- **插槽内容**里的组件引用能拿到，但拿不到插槽作用域的数据流。
- `<script>` 里 `this` 相关的选项式 API 方法抽取较弱，`export default { methods: {...} }` 这种写法方法可能漏。

## Python

**能拿到**：`def` / `async def` / `class`（含基类）、`import` / `from ... import`。

**会失真**：

- **缩进判定容器**：方法归属靠缩进与前面的 `class` 判断，混用 tab/空格或装饰器嵌套时会错。
- **`__all__`** 不看，导出判断只看是否 `_` 开头。
- 动态属性、`setattr`、元类生成的成员看不见。

## Go

**能拿到**：`func`（含 receiver 方法）、`type`（struct/interface）、`import` 块与单行 import。

**会失真**：

- **接口实现是隐式的**，没有 `implements` 声明，所以"谁实现了这个接口"完全拿不到。
- 包级变量、`init()` 里的注册逻辑看不见。
- 方法集（值接收者 vs 指针接收者）不区分。

## 其它语言（Ruby / PHP / C# / Rust）

只做**文件级**统计：行数、目录、大小、导入行数。不产符号。

如果目标仓库主要是这些语言，SKILL.md 里要直接告诉用户："这套工具在这个仓库只能给到文件级地图，
符号查询不可用，改用 IDE 或语言专用工具（`ctags`、`rust-analyzer`、`gopls`）。**不要假装能用。**"

## 跨语言的共同盲区

无论哪种语言，下面这些**永远看不见**，必须在手册里明写：

1. **反射 / 动态派发**：`Class.forName`、`getattr`、`import()` 拼字符串。
2. **框架的字符串约定**：Spring 的 bean 名、MyBatis 的 XML namespace、Django 的 `INSTALLED_APPS`。
3. **消息队列**：生产者发了个 topic，消费者在另一个仓库。
4. **配置驱动的行为**：`handlers: [a, b]` 写在 YAML 里。
5. **跨进程 / 跨服务调用**：Feign 客户端、gRPC stub、HTTP SDK。
6. **代码生成**：protobuf、OpenAPI generator、Annotation processor 产出的类不在源码里。

写影响面分析时，这六类要先声明"不在索引里"，再给结论。否则读者会以为"索引没提到 = 没人用"，
这个误判在生产上代价很高。
