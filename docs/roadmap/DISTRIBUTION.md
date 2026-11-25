# 6. Distribution and trust

Part of the [Roadmap](README.md). Status: proposal.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 6.1 | Signed and notarised builds | No Gatekeeper or SmartScreen warning at install | `electron-builder.json` has `notarize: false` and `forceCodeSigning: false` today | L, needs paid certificates |
| 6.2 | Website and user docs | A landing page and help site | `package.json` references a `website` folder that does not exist; [LANDING_PAGE.md](../LANDING_PAGE.md) is the brief | L |
| 6.3 | arm64 builds for Windows and Linux | The app runs natively on arm64 PCs and Linux machines | `electron-builder.json` builds x64 only for both; macOS already ships both | M |
| 6.4 | Legal pages | Working Terms of Service and Privacy Policy, and a notices file for bundled third-party work | Since 2026-11-24 the sign-up screen (`src/renderer/src/pages/start/components/AuthStep.tsx`) links both to kucedr.com through `links` in `package.json`, and both pages load. No notices file yet | S |
| 6.5 | Published CLI and SDK | The command-line tool and the SDK installable from npm | Both exist in `packages/cli` and `packages/sdk`; the publish workflow is disabled | S |

6.4 is in the first step of the [recommended order](README.md#recommended-order).

## What signing unlocks

- The remaining hardening items in the [Security audit](../SECURITY_AUDIT.md) (#18, #25).
- Full protection from encrypted data and app lock ([Privacy](PRIVACY.md), 1.3 and 1.4).
- Paid plugins from outside authors ([Plugins](PLUGINS.md), 8.6 and 8.7).

## Documentation to correct alongside

[FEATURES.md](../FEATURES.md) still describes a signed installer.
