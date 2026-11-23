---
name: pnpm-cli-repair
description: "两类高频 pnpm 失败的确定性排查：① Windows 上 pnpm 报 MODULE_NOT_FOUND —— corepack shim 指向一个拼错的历史安装路径，绕过 corepack 直连 pnpm.mjs；② pnpm 11 起 strictDepBuilds 默认 true，未审批的构建脚本让 install 直接失败、node_modules 整体不生成，需用 pnpm-workspace.yaml 的 allowBuilds 白名单。含 git 依赖审批的精确匹配规则。Repair broken pnpm shims and pnpm 11 ignored-build failures."
whenToUse: "pnpm -v 就报 MODULE_NOT_FOUND 且路径里有明显拼错的目录名；能跑 pnpm install 但报错说 Ignored build scripts / ERR_PNPM_IGNORED_BUILDS；装完 node_modules 缺失导致 vite 不是内部或外部命令；老项目从 pnpm 10 升 11 后 install 突然挂。"
---

# pnpm 两类高频失败：shim 指错路径 / 构建脚本未审批

这两个问题症状很像——都是「`pnpm install` 没装出 node_modules，于是 `pnpm run dev` 报 `vite` 不是内部或外部命令」——但根因完全不同，别混着查。

| | 类型 A：shim 指错 | 类型 B：构建脚本被拦 |
|---|---|---|
| 触发时机 | `pnpm -v` 就崩 | `pnpm -v` 正常，install 阶段失败 |
| 关键字 | `MODULE_NOT_FOUND`、`Cannot find module .../pnpm.js` | `ERR_PNPM_IGNORED_BUILDS`、`Ignored build scripts` |
| 根因 | corepack shim 里硬编码了拼错的历史路径 | pnpm 11 的 `strictDepBuilds` 默认开启 |

## 类型 A：shim 里的错误路径

### 症状

```
Error: Cannot find module 'D:\<拼错的安装目录>\node_modules\corepack\dist\pnpm.js'
code: 'MODULE_NOT_FOUND'
```

典型成因：某个历史安装目录名被拼错，当时生成的 shim 把这个错路径**固化在三处**里。后来目录名修正了，shim 没跟着改。

### 诊断

```bash
# 1. shim 里是不是真有错路径
grep -n "corepack" "<node-versions>/<ver>/pnpm.ps1"   # 路径里有没有拼错的目录名

# 2. 真正的 pnpm 本体在不在
ls -la "$APPDATA/npm/node_modules/pnpm/bin/pnpm.mjs"
```

`<node-versions>` 依运行环境而定（托管型 IDE 常在用户目录下的 `.workbuddy/binaries/node/versions/`）。

### 修复：绕过 corepack，直连 pnpm.mjs

**别只把拼错的字母改对**——corepack 仍多一层，容易再坏。三件套都要指向真实 `pnpm.mjs`：

```
<node-versions>/<ver>/pnpm       # sh / Git Bash
<node-versions>/<ver>/pnpm.CMD   # cmd
<node-versions>/<ver>/pnpm.ps1   # PowerShell
```

先备份，再替换路径字符串：

```bash
mkdir -p <backup-dir> && cp pnpm pnpm.CMD pnpm.ps1 <backup-dir>/
```

`pnpm.ps1` 的核心改法：

```powershell
$REAL_PNPM = "C:\Users\<user>\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.mjs"
# 原本指向 corepack/dist/pnpm.js 的位置全部换成 $REAL_PNPM
& "$basedir/node$exe" $REAL_PNPM $args
```

验证要在干净目录做（避开项目 `preinstall` 干扰）：

```bash
node "C:/Users/<user>/AppData/Roaming/npm/node_modules/pnpm/bin/pnpm.mjs" -v
```

## 类型 B：pnpm 11 的 `ERR_PNPM_IGNORED_BUILDS`

### 症状

```
ERR_PNPM_IGNORED_BUILDS  Ignored build scripts: @parcel/watcher@2.6.0, esbuild@0.21.5, ...
ERR_PNPM_PREPARE_PACKAGE Failed to prepare git-hosted package fetched from "<私有仓库 URL>"
```

**后果是 `node_modules` 整体不生成**，于是看起来像 shim 坏了。

### 根因

**pnpm 11 起 `strictDepBuilds` 默认为 `true`**：任何未审批的依赖构建脚本（postinstall）会让 `install` 以非零码退出；pnpm 10 只是警告。

git-hosted 依赖被 clone 到临时目录后还会再跑一次 `pnpm install`，它自己的依赖里有未审批的 postinstall 就会连带失败——所以报错落在 git 包上，但真因在审批清单。

### 修复：建 `pnpm-workspace.yaml`，用 `allowBuilds`

⚠️ pnpm 11 **已移除** `onlyBuiltDependencies`、`onlyBuiltDependenciesFile`、`neverBuiltDependencies`、`ignoredBuiltDependencies`、`ignoreDepScripts`——网上旧教程全部失效。统一改用 `allowBuilds`（包名 → boolean）：

```yaml
allowBuilds:
  esbuild: true              # Vite 依赖，postinstall 不跑就没有二进制
  '@parcel/watcher': true    # 原生模块需编译
  protobufjs: true
  vue-demi: true
```

### git 依赖的审批规则（最容易踩）

> 官方原话：a package name on its own never approves builds for a git or tarball dependency — the name alone does not identify the artifact.

只写 `ui-kit: true` **无效**。必须写完整标识：

| 形式 | 写法 | 适用 |
|---|---|---|
| 仓库形式（推荐） | `'ui-kit@git+<url>': true` | 跨 commit 长期有效，不带 `#ref` |
| 精确 commit | `'ui-kit@git+<url>#abc123': true` | 只认这一个版本 |

匹配是**精确匹配**：`git+ssh://` 和 `git+https://` 算两个不同 key。v11.11.0+ 仓库形式也覆盖以 tarball 方式下载的 git 依赖。

### 备选方案（安全性递减）

| 方案 | 效果 | 风险 |
|---|---|---|
| `allowBuilds: {...}` 白名单 | 只放行审阅过的 | 低 ✅ |
| `strictDepBuilds: false` | 未审批的降级为警告 | 中 |
| `dangerouslyAllowAllBuilds: true` | 全部放行（含传递依赖与未来新增） | 高，不推荐 |

## 顺带两个 pnpm 11 变化

1. `package.json` 里的 `pnpm` 字段**不再被读取**（`WARN: The "pnpm" field in package.json is no longer read by pnpm`）→ 其中的 `overrides` 等要迁到 `pnpm-workspace.yaml` 的 `overrides:`。
2. 项目若只有 `yarn.lock` 却写了 `preinstall: npx only-allow pnpm`，用 `pnpm install --no-frozen-lockfile`，别加 `--frozen-lockfile`。

## 沙箱 / 宿主 hook 干扰

某些受管环境里 `pnpm install` 会被宿主的安全 hook 拦下，报 `safe-delete` / `trash` 操作失败——这是 pnpm 清理临时文件时触发的限制，**不是项目问题**。用户本机终端一般不受影响。遇到时先去掉 `--frozen-lockfile` 重试，仍不行就请用户在自己的终端执行。

## 边界

- 类型 A 的修复改的是本机 shim，不动项目文件；改之前一定备份。
- 类型 B 的白名单要按项目实际依赖审阅，不要直接全放行。
- 两类都不负责网络/私服鉴权；`ERR_PNPM_PREPARE_PACKAGE` 若伴随 401/403，先解决凭据。
