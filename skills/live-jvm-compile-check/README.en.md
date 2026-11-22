# live-jvm-compile-check

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Compile-check Java edits **against a running JVM** — without touching `target/classes`, and without `mvn compile` / `clean` / IDE Build.

## Why this exists

Running `mvn compile` while the service is up rewrites `target/classes`. The live JVM then loads new bytecode against old state, and you get `NoClassDefFoundError`, `ClassNotFoundException`, or a bare `System exception` in the UI.

So the usual advice is "don't compile". That leaves you with no verification at all — the user restarts, hits a typo, and restarts again.

This skill extracts the real classpath **from the running JVM**, then runs `javac` into a temp directory. Nothing in the build output is modified.

## When to use

- A Spring Boot service is running and you just edited several `.java` files
- You want a definitive answer on whether a method signature exists in the *currently running* dependency version
- Someone is about to restart and you'd rather they only restart once

**Not for**: validating runtime behaviour, packaging, or releasing. It answers exactly one question — does it compile.

## The four things that actually bite

1. **`-proc:none` silently disables Lombok.** Every `log` / getter becomes "cannot find symbol". Use `-proc:full`.
2. **Backslashes in the `@argfile` must become forward slashes.** Otherwise the entire classpath silently fails — no error, just thousands of missing imports.
3. **Write `D:/...`, not `/d/...`.** Java is a native Windows binary.
4. **IDEA-launched JVMs often have no third-party jars in `java.class.path`.** Fall back to the fat jar's `BOOT-INF/lib`.

## Usage

```
The service is still running — don't compile. Check whether my edits build.
```

Full command sequence is in [SKILL.md](SKILL.md).

## ⚠️ Boundaries

- Proves **compilation only**. Packaging, resource copying, Spring wiring and real behaviour still need a real build + restart.
- The classpath reflects the **running** version. If you just bumped a dependency, the result does not cover the new one.
- Always tell the user "needs a restart to take effect". Do not let them think a passed compile means shipped.

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

Or link a single skill:

```powershell
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\live-jvm-compile-check" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\live-jvm-compile-check"
```

Harness-agnostic: the payload is `SKILL.md`. Copy the directory into any agent that understands `SKILL.md`.

## Platform

Written on Windows (PowerShell, absolute paths to `jcmd` / `javac`). On Linux/macOS, replace the `VM.system_properties` step with a shell pipeline; the rest is identical.
