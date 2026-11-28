# Open items

Part of the [Roadmap](README.md). Written 2026-11-28 from the status text of each area file, not
re-checked against the code. An item leaves this list when its area file marks it built; the area
file is the source of truth.

Size: **S** a few days, **M** one to two weeks, **L** more than that or dependent on an outside
decision.

## Added 2026-11-27 and 2026-11-28

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 20.10 | [Coding interface and module](CODING.md) | All | L |
| 21.14 | [Sensitive data sealed before it reaches the model](SECURITY.md) | All | L |
| 1.14 | [Protection levels for personal data](PRIVACY.md) | All | L |
| 23.21 | [Saved passwords that work](BROWSER.md) | Sign-in forms inside a frame | S–M |

Built from the same list: ads, pop-ups and cookie banners (13.15), voice control of the browser
(19.5, not run live), drag and drop from outside (10.11) and Lock Now (1.13).

## 1. [Privacy](PRIVACY.md)

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 1.1 | Privacy centre | Plugin traffic in the recipient view | S |
| 1.3 | Encrypted data at rest | The plain files listed in the area file (knowledge index, task prompts, media) | L |
| 1.4 | App lock | Windows Hello | S |
| 1.5 | Encrypted backup | All | M |
| 1.6 | Private chat | All | M |
| 1.8 | Account and cloud data deletion | All | M |
| 1.9 | Encrypted sync across devices | All | L |
| 1.10 | App-wide Privacy Mode | The known gaps listed in the area file (loopback spellings fixed 2026-11-28) | L |

## 3 to 7. Experience, accessibility, distribution, languages

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 3.10 | [Chat export, import and sharing](EXPERIENCE.md) | All | S–M |
| 4.5 | [Accessibility checks](ACCESSIBILITY.md) | All; blocked on two development dependencies | S |
| 6.1 | [Signed and notarised builds](DISTRIBUTION.md) | All; needs paid certificates | L |
| 6.2 | [Website and user docs](DISTRIBUTION.md) | All | L |
| 6.3 | [arm64 builds for Windows and Linux](DISTRIBUTION.md) | All | M |
| 6.5 | [Published CLI and SDK](DISTRIBUTION.md) | All | S |
| 7.1 | [Complete Italian](LANGUAGES.md) | All | M |
| 7.2 | [More languages](LANGUAGES.md) | All | M each |

## 8 and 9. [Plugins](PLUGINS.md) and [payments](PAYMENTS.md)

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 8.1 | Plugin catalogue | All | L |
| 8.2 | Sign-in for plugin servers | All | S–M |
| 8.3 | Sign-in declared by a plugin | All | M |
| 8.4 | Kucedr identity for plugins | All | M |
| 8.5 | Paid plugins sold by the author | All | S |
| 8.6 | Paid plugins sold in the catalogue | All | L |
| 8.7 | Publisher accounts and payouts | All | L |
| 8.8 | App bridge and settings forms | The unbuilt part | M |
| 9.1 | Kucedr Storage | All | L |
| 9.2 | Plans and checkout | All | M |
| 9.3 | Entitlements | All | M |
| 9.4 | Manage subscription | All | S |
| 9.5 | Further paid services | All | L each |
| 9.6 | Desk licence | All | M |

## 10 to 13. Workspaces, Tor, VPN, shield

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 10.5 | [Delete and move](WORKSPACES.md) | All | S |
| 10.10 | [Sealed case](WORKSPACES.md) | All | M |
| 10 | [Workspaces](WORKSPACES.md#left) | The "Left" list | — |
| 11.4 | [Built-in Tor](TOR.md) | All | L |
| 12.3 | [Browse through a VPN profile](VPN.md) | All | L |
| 12.4 | [Route indicator and per-workspace default](VPN.md) | The per-workspace default | S |
| 12.5 | [Proxy profiles with login](VPN.md) | All | S–M |
| 13.1 | [Tracker and ad blocking](SHIELD.md) | The ad list | M |
| 13.2 | [Site rules](SHIELD.md) | All | M |
| 13.4 | [Command and plugin limits](SHIELD.md) | All | M–L |
| 13.6 | [Browsing hygiene](SHIELD.md) | HTTPS first (left out by decision: the http fallback broke pages on Electron 44) | S |
| 13.7 | [Remote content in documents](SHIELD.md) | The tighter content policy | M |
| 13.8 | [Network view](SHIELD.md) | All | M |
| 13.9 | [Local-only switch](SHIELD.md) | All | M |
| 13.12 | [Dangerous site blocking](SHIELD.md) | The phishing list | S |
| 13.13 | [Site permission prompts](SHIELD.md) | Remembered answers per site | M |

## 14 to 18. Terminal, local models, automation, integrations, memory

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 14.1 | [Sound back end](TERMINAL.md) | The remainder | M |
| 14.2 | [Terminal panel](TERMINAL.md) | All | M |
| 14.3 | [Tabs and essentials](TERMINAL.md) | All | M |
| 14.4 | [Clean environment](TERMINAL.md) | All | S |
| 14.5 | [Terminal and chat](TERMINAL.md) | All | M |
| 14.6 | [Agent commands visible](TERMINAL.md) | All | M |
| 14.7 | [Checks](TERMINAL.md) | All | S |
| 15.2 | [Model downloads](LOCAL.md) | All | M |
| 15.3 | [Local knowledge](LOCAL.md) | All | M |
| 15.5 | [Built-in runtime](LOCAL.md) | All | L |
| 16.2 | [Run history](AUTOMATION.md) | All | S |
| 16.4 | [Catch-up](AUTOMATION.md) | All | S |
| 16.6 | [Health results](AUTOMATION.md) | All | M |
| 16.7 | [Run while closed](AUTOMATION.md) | All | L |
| 17.1 | [One-click sign-in](INTEGRATIONS.md) | All; needs provider verification | L |
| 17.2 | [Complete mail tools](INTEGRATIONS.md) | All | M |
| 17.3 | [Connector management](INTEGRATIONS.md) | All | M |
| 17.4 | [Per-workspace accounts](INTEGRATIONS.md) | All | M |
| 17.5 | [Messaging channels](INTEGRATIONS.md) | All | L |
| 18.5 | [Refresh while closed](MEMORY.md) | All | L |

## 19 to 22. Voice, coding, security, quality

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 19.3 | [Approvals by voice](VOICE.md) | Other side-effect tools, approval by voice | M |
| 19.4 | [Hand off to chat](VOICE.md) | All | M |
| 20.1 | [Coding page shipped](CODING.md) | All | L |
| 20.2 | [Same permission rules](CODING.md) | All | M |
| 20.3 | [Terminal inside coding](CODING.md) | All | M |
| 20.4 | [Version control view](CODING.md) | All | M |
| 20.5 | [More coding harnesses](CODING.md) | All | L |
| 20.6 | [Coding agent as a chat tool](CODING.md) | All | M |
| 20.7 | [Live coding-agent progress](CODING.md) | All | M |
| 20.8 | [Coding-agent approvals in the chat](CODING.md) | All | M |
| 20.9 | [Steer a running coding agent](CODING.md) | All | M |
| 21.1 | [Voice runs actions without asking](SECURITY.md) | With 19.3 | M |
| 21.2 | [Workspace skills override trusted ones](SECURITY.md) | A decision | S |
| 21.3 | [Restore can plant code](SECURITY.md) | Cloud version sync, coder harness homes | M |
| 21.7 | [Broad content policy](SECURITY.md) | Inline scripts, `https:` images, `local-resource:` paths | S |
| 21.8 | [Build hardening](SECURITY.md) | All; with 6.1 | L |
| 21.9 | [Audit kept current](SECURITY.md) | All | S |
| 21.10 | [Sandboxed commands reach any host](SECURITY.md) | The network allow-list | S |
| 21.11 | [Assistant edits its own prompt](SECURITY.md) | A decision; a diff in the approval card | S |
| 22.2 | [Coverage in CI](QUALITY.md) | All | S |
| 22.3 | [Real-app checks](QUALITY.md) | All | M |
| 22.4 | [Docs match the app](QUALITY.md) | All | S |

## 23 to 25. Browser, computer use, evidence

| # | Item | Left | Size |
| --- | --- | --- | --- |
| 23.5 | [Import sign-ins](BROWSER.md) | All; waits on an open decision | M–L |
| 23.7 | [Agent signs in with a saved login](BROWSER.md) | All; waits on an open decision | M |
| 23.8 | [Carry over the old agent profile](BROWSER.md) | All; waits on an open decision | S |
| 23.11 | [Addresses and contact details](BROWSER.md) | All | M |
| 23.12 | [Form history](BROWSER.md) | All | S |
| 23.13 | [Secure password store](BROWSER.md) | The optional primary password | M |
| 23.14 | [Password manager in Settings](BROWSER.md) | Add by hand, reveal, copy, export, "last used", undo | S–M |
| 23.15 | [Bookmarks in Settings](BROWSER.md) | Folders, moving, multi-select, undo | M |
| 23 | [Browser](BROWSER.md#not-implemented-yet) | The rest of the "Not implemented yet" list | — |
| 24.1–24.10 | [Computer use](COMPUTER.md) | All ten items | L |
| 25.3–25.12 | [Cases and evidence](EVIDENCE.md) | All ten items; 25.1 and 25.2 are built | M–L |
