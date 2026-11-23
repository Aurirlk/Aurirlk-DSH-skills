# pnpm-cli-repair

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

两类失败，症状几乎一样（install 完没有 node_modules，于是 `vite` 不是内部命令），根因完全不同：shim 指错路径，或者 pnpm 11 的构建脚本审批。先看关键字，别混着查。

## 什么时候用

- `pnpm -v` 就报 `MODULE_NOT_FOUND`，路径里有个明显拼错的目录名
- `pnpm -v` 正常，但 install 报 `ERR_PNPM_IGNORED_BUILDS` / `Ignored build scripts`
- 从 pnpm 10 升到 11 之后，原本能装的依赖突然挂了

## 怎么分

| | A：shim 指错 | B：构建脚本被拦 |
|---|---|---|
| `pnpm -v` | 就崩 | 正常 |
| 关键字 | `MODULE_NOT_FOUND` | `ERR_PNPM_IGNORED_BUILDS` |
| 修法 | 绕过 corepack，直连 `pnpm.mjs` | 写 `allowBuilds` 白名单 |

## 两个最值钱的结论

**A 类别只改拼写。** shim 硬编码了拼错的历史路径，把字母改对了 corepack 还在中间，容易再坏；三件套（`pnpm` / `pnpm.CMD` / `pnpm.ps1`）全部直连真实的 `pnpm.mjs`，改前备份。

**B 类别再抄旧教程。** pnpm 11 已移除 `onlyBuiltDependencies` / `neverBuiltDependencies` / `ignoreDepScripts` 等字段，只认 `pnpm-workspace.yaml` 里的 `allowBuilds`。而且 **git 依赖不能用纯包名审批**——必须写 `'ui-kit@git+<url>': true`，`git+ssh://` 和 `git+https://` 还是两个不同的 key。

完整步骤、审批表、pnpm 11 另外两个变化（`package.json` 的 `pnpm` 字段不再读取）见 [SKILL.md](SKILL.md)。

## 用法

```
pnpm -v 报 MODULE_NOT_FOUND，路径里有个拼错的目录，帮我修
```

```
pnpm install 报 ERR_PNPM_IGNORED_BUILDS，node_modules 都没生成
```

## 安装

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

只装这一个见 [仓库首页](../../README.md#只想装其中一个)。

## 边界

- A 类改的是本机 shim，不动项目文件；改前必须备份
- B 类白名单要按项目实际依赖审阅，不要直接全放行
- 若报错伴随 401/403，先解决私服凭据，本技能不处理鉴权
