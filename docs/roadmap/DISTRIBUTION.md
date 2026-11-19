# 6. Distribution and trust

Part of the [Roadmap](README.md). Status: proposal.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 6.1 | Signed and notarised builds | No Gatekeeper or SmartScreen warning at install | `electron-builder.json` has `notarize: false` and `forceCodeSigning: false` today | L, needs paid certificates |
| 6.2 | Website and user docs | A landing page and help site | `package.json` references a `website` folder that does not exist; [LANDING_PAGE.md](../LANDING_PAGE.md) is the brief | L |

## What signing unlocks

- The remaining hardening items in the [Security audit](../SECURITY_AUDIT.md) (#18, #25).
- Full protection from encrypted data and app lock ([Privacy](PRIVACY.md), 1.3 and 1.4).
- Paid plugins from outside authors ([Plugins](PLUGINS.md), 8.6 and 8.7).

## Documentation to correct alongside

[FEATURES.md](../FEATURES.md) still describes a signed installer.
