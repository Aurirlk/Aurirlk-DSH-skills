# deploy-access-chain

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

You edited the files, rebuilt, overwrote the deploy target. Refresh — still the old version.

This is the most draining class of ops problem: **every step you take is correct, yet nothing changes.** So you overwrite again, purge caches, reload — each time it "seems" to work, and the next refresh serves the old build.

There is usually exactly one cause: **the file you changed isn't on the request path.**

## When to use

- Rebuilt and copied the frontend bundle; the browser still sees the old build
- Unsure whether requests hit local nginx, an upstream LB, a CDN, or another instance
- Need to know whether a config file is actually on the request path
- You already tried cache busting / `?bust=` / reload — no effect

## Don't start by overwriting

Start by **proving which file the request actually hits**.

Five layers, cheapest first:

```
1 Build fingerprint → asset hash / buildTime, search the whole disk
2 Response headers  → Last-Modified, Server, Via, X-Cache, custom add_header
3 Access log        → curl before/after, any new lines? ← the decisive one
4 Listening sockets → ss -lntp, /proc/net/tcp, iptables / nft, netns
5 DNS two paths     → getent + curl --resolve (both 127.0.0.1 and the private IP)
```

**Layer 3 saves hours.** A public request that appends to the local `access.log` proves the traffic flows through this node. Zero new lines proves it doesn't — and overwriting local files will never take effect.

## Verdict discipline (the real core)

| Kind | Requirement |
|---|---|
| Hard fact | Attach the command and raw output |
| Inference | **State what result would refute it** |
| Retracted | Retract explicitly; keep the facts that still hold |

An inference without a falsification condition hardens itself — every contradicting observation becomes "one of the other cases".

## Five traps

- **A missing JS file can still return 200** — SPA `try_files` fallback. Status codes can't prove a file exists.
- **`?bust=` failing does not rule out a CDN** — CDNs often ignore query strings and client `no-cache`.
- **`nginx -T | grep <dirname>` returning nothing proves nothing** — implicit root, wildcard locations.
- **Config may not live in a `.conf` at all** — panels like nginxWebUI keep it in SQLite and push it out, and can manage remote nodes.
- **Multi-line pasted commands get mangled** — line continuations vanish, `2>/dev/null` swallows the error, you get a silent empty result.

## ⚠️ Boundaries

- **Read-only forensics.** Don't overwrite, delete, or reload production files until the chain is confirmed.
- nginx / CDN / LB oriented; the reasoning transfers, the commands do not.
- Before installing a package (`tcpdump` etc.), ask whether the same conclusion is reachable without it.

## Usage

```
Frontend overwrote cleanly but production still serves the old build. Find where requests actually land.
```

```
Who terminates 443 for this domain? Give me the single decisive experiment.
```
