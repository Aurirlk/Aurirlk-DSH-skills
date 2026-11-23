# pnpm-cli-repair

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Two failures with nearly identical symptoms (no `node_modules` after install, so `vite` is "not recognized") but completely different causes: a broken shim path, or pnpm 11's build-script approval gate. Read the error keyword before you start digging.

## When to use

- `pnpm -v` immediately fails with `MODULE_NOT_FOUND` and a misspelled directory in the path
- `pnpm -v` works, but install fails with `ERR_PNPM_IGNORED_BUILDS` / `Ignored build scripts`
- Dependencies that installed fine on pnpm 10 start failing after the 11 upgrade

## Telling them apart

| | A: broken shim | B: blocked builds |
|---|---|---|
| `pnpm -v` | crashes | fine |
| Keyword | `MODULE_NOT_FOUND` | `ERR_PNPM_IGNORED_BUILDS` |
| Fix | bypass corepack, call `pnpm.mjs` directly | write an `allowBuilds` allowlist |

## The two conclusions worth remembering

**For A, don't just fix the typo.** The shim hardcoded a misspelled historical path; correcting the letters still leaves corepack in the middle. Point all three launchers (`pnpm`, `pnpm.CMD`, `pnpm.ps1`) at the real `pnpm.mjs`, and back them up first.

**For B, stop reading pnpm 10 tutorials.** pnpm 11 removed `onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoreDepScripts` and friends — only `allowBuilds` in `pnpm-workspace.yaml` works. Also, **a bare package name never approves a git dependency**: write `'ui-kit@git+<url>': true`, and note that `git+ssh://` and `git+https://` are different keys.

Full steps, the approval table, and two more pnpm 11 changes (including `package.json`'s `pnpm` field no longer being read) are in [SKILL.md](SKILL.md).

## Usage

```
pnpm -v fails with MODULE_NOT_FOUND and a misspelled directory in the path
```

```
pnpm install reports ERR_PNPM_IGNORED_BUILDS and node_modules is missing
```

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

See the [collection index](../../README.en.md#installing-a-single-skill) to install only this one.

## Boundaries

- Type A edits local shims, never project files; back them up first.
- Type B allowlists must be reviewed against real dependencies — don't allow everything.
- 401/403 means solve registry credentials first; auth is out of scope.
