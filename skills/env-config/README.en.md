# env-config

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

Turn a missing config into a working setup.

## What this fixes

An agent needs a path or a key from `.env`, and it isn't there.

The two bad ways to handle that:

- Say "please configure `XXX_PATH` in `.env`" and stop. The user has no idea what to put, where, or whether it worked.
- **Worse**: treat the empty value as "not configured" and quietly continue with a default. Twenty minutes later something fails somewhere unrelated, and the error points at the wrong place.

This skill does the third thing: **block before the main flow starts**, narrow the problem down to one specific entry across three layers, and walk the user through filling and verifying it.

## The three layers

```
.env exists?
  ├─ no  → copy .env.example; only ask the user if there is none
  └─ yes → does the variable have a real value?
            ├─ no  → ask for all missing values at once, not one at a time
            └─ yes → is the value valid?
                     ├─ no  → validate by type (path / URL / port / flag / key)
                     └─ yes → carry on with the actual task
```

## Where it is strict

**"Has a value" is not "has a value."** `KEY=`, `KEY="  "`, `KEY=your-key-here`, `KEY=changeme` all count as unset. Placeholders are the nastiest case: they look configured, survive all the way to a network call, and then fail with an error that points somewhere else.

**Relative paths are a trap.** `./repo` resolves against the **process working directory**, not the directory holding `.env`. That is why "it works in directory A and breaks in B." Fix it with an absolute path, not by editing code.

**Keys are never echoed.** After writing a secret, report "configured" — never print it back. If the user would rather not paste a key into the chat, let them fill it themselves and just re-check the format.

**CI has no `.env`.** So the read order has to be "process env → `.env` → default." If the file wins over the environment, CI silently uses the default while local runs fine — a bug that only exists on the pipeline.

## When you'll reach for it

- A teammate clones the repo and the very first step fails.
- New machine, copied someone else's `.env`, every path is wrong.
- A skill needs a working directory, a key, or a flag and can't get it.
- The error says "file not found" but the real cause is an empty config value.

## Install

```bash
# whole collection
pnpm add github:Aurirlk/Aurirlk-DSH-skills

# or just this one
ln -s "$PWD/skills/env-config" ~/.dsh/skills/env-config
```

## What it won't do

- Invent a key. A fabricated placeholder is a delayed bomb.
- Commit `.env`. Check `.gitignore` first.
- Change code to accommodate a broken config. Configuration is external input; code shouldn't bend for it.

## See also

- [git-submit-safety](../git-submit-safety/README.en.md) — exact pathspecs, and a side benefit: `.env` never gets staged
- [no-stub-delivery](../no-stub-delivery/README.en.md) — fake config and fake data are the same failure
