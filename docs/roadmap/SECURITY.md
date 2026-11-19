# 21. Security hardening

Part of the [Roadmap](README.md). Status: proposal.

The items from the [Security audit](../SECURITY_AUDIT.md) and the permission reviews that are still
open. The audit's own status table is out of date: [PERMISSIONS_PLAN.md](../PERMISSIONS_PLAN.md)
records several of its items as fixed since. The list below was read from those docs on 2026-11-19;
only #17, #22 and #24 were checked in code.

## Open items

| # | Item | What it means for the user | Where it is handled | Size |
| --- | --- | --- | --- | --- |
| 21.1 | Voice runs actions without asking (audit #7) | A spoken request can change files or send data with no confirmation | [Voice](VOICE.md), 19.3 | M |
| 21.2 | Workspace skills override trusted ones (audit #11) | A file in the workspace can replace a built-in skill of the same name | Decide: trusted skills win, or the user confirms | S |
| 21.3 | Restore can plant code (audit #17) | Restoring a backup can bring in plugins, skills or connector servers; only settings, providers and storage are protected (`src/main/storage/storage_protected.ts`) | Confirm restored code before it is enabled | M |
| 21.4 | Plugin download checks (audit #19) | Plugin packages need a verified checksum and size limits when unpacked | With the catalogue ([Plugins](PLUGINS.md), 8.1) | S |
| 21.5 | Browser reaches private hosts (audit #21) | A page the agent opens can reach devices on the local network | [Network shield](SHIELD.md), 13.5 | S |
| 21.6 | No task frequency limit (audit #22) | A task can be scheduled to run without pause | [Automation](AUTOMATION.md), 16.5 | S |
| 21.7 | Broad content policy (audit #24) | The app window allows inline scripts and a script CDN (`src/renderer/index.html`) | [Network shield](SHIELD.md), 13.7 | S |
| 21.8 | Build hardening (audit #18, #25) | Unsigned builds, permissive entitlements, unsigned updates | [Distribution and trust](DISTRIBUTION.md), 6.1 | L |
| 21.9 | Audit kept current | The audit table matches the code, with each item marked fixed, open or decided | [Quality](QUALITY.md), 22.4 | S |

## Open decisions

- **21.1, 21.2 and 21.3 are recorded as "decision" in the audit.** Recommended: ask before
  side-effect actions in voice, trusted skills win, and restored code stays disabled until the user
  confirms it.
- **Order.** 21.3 before hosted storage ([Payments](PAYMENTS.md), 9.1), since restore becomes a
  common path once backup is a product.
