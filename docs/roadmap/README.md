# Roadmap

Status: proposal, written 2026-11-19. Built since: sealed credentials on disk (1.2), the first four agent efficiency
features ([2.1–2.4](PERFORMANCE.md)), completion
notifications (3.1), regenerate and retry (3.3), the browser pane (3.9), most of the agent cursor
(3.11), browser control from the chat (3.12) and most of browser import
(23), screen-reader chat, keyboard use, high contrast and named controls (4.1–4.4), replies that
survive leaving Home (5.3), the Terms and Privacy links (6.4), fast knowledge retrieval (18.6),
private, Tor and proxy tabs with the first network shield pieces (11.1–11.3, 12.1, 12.2, 13.3,
13.5, 13.11, part of 13.6), and a test baseline with one failing test left (22.1); each
area file says what is left. Each feature
gets its own detailed plan before any implementation starts.

This folder lists the features proposed for Kucedr, one file per area. Each file says what the user
gets, what already exists to build on, a rough size, and the decisions still open. Statements about
current behaviour come from a read of the checkout on the date above; items marked _(not verified)_
or _(not measured)_ were read from code or docs and not confirmed in the running app.

Size is a rough guide: **S** a few days, **M** one to two weeks, **L** more than that or dependent
on an outside decision.

## Areas

| # | Area | Features |
| --- | --- | --- |
| 1 | [Privacy](PRIVACY.md) | Privacy centre, sealed credentials, encrypted data, app lock, encrypted backup, private chat, storage management, account deletion, encrypted sync, app-wide Privacy Mode |
| 2 | [Performance and agent efficiency](PERFORMANCE.md) | Automatic compaction, run insights, run budgets, lighter first message, smooth streaming, instant start, performance check, spend tracking |
| 3 | [User experience](EXPERIENCE.md) | Notifications, search across chats, regenerate, "/" menu, shortcut guide, failure states, undo, attachment checks, browser pane, chat export and import, agent cursor in the browser pane, browser control from the chat |
| 4 | [Accessibility](ACCESSIBILITY.md) | Screen-reader chat, full keyboard use, high contrast and text size, named controls, automatic checks |
| 5 | [Reliability and updates](RELIABILITY.md) | Stable and beta channels, crash recovery, replies that survive leaving Home |
| 6 | [Distribution and trust](DISTRIBUTION.md) | Signed builds, website and user docs, arm64 builds, legal pages, published CLI and SDK |
| 7 | [Languages](LANGUAGES.md) | Complete Italian, more languages |
| 8 | [Plugins](PLUGINS.md) | Catalogue, sign-in (OAuth) for plugins, paid plugins, app bridge |
| 9 | [Payments and paid services](PAYMENTS.md) | Kucedr Storage, plans and checkout, entitlements, subscription management |
| 10 | [Multiple workspaces](WORKSPACES.md) | Workspaces and switcher, separate chats, memory and sign-ins |
| 11 | [Tor and .onion sites](TOR.md) | Tor tabs in the browser pane |
| 12 | [Private and VPN browsing](VPN.md) | Private tabs, proxy and VPN routes for the browser pane |
| 13 | [Network shield](SHIELD.md) | Tracker blocking, site rules, secret guard, local network protection, network view, untrusted content marking, download protection |
| 14 | [Terminal](TERMINAL.md) | Back-end fixes, terminal panel, tabs, clean environment, terminal and chat together |
| 15 | [Local models and offline use](LOCAL.md) | Setup with a local model, model downloads, local knowledge, offline behaviour |
| 16 | [Automation](AUTOMATION.md) | Create and edit tasks, run history, failures surfaced, catch-up, health results |
| 17 | [Integrations](INTEGRATIONS.md) | One-click Google and Microsoft sign-in, complete mail tools, connector management |
| 18 | [Memory and knowledge](MEMORY.md) | See and edit memory, remember and forget in chat, knowledge sources at a glance, fast knowledge retrieval |
| 19 | [Voice](VOICE.md) | Mute and status, transcripts where available, approvals by voice |
| 20 | [Coding page](CODING.md) | Ship or remove the coding page, same permission rules, terminal inside coding |
| 21 | [Security hardening](SECURITY.md) | The security audit items still open |
| 22 | [Quality](QUALITY.md) | Green tests, coverage in CI, real-app checks, docs that match the app |
| 23 | [Browser import](BROWSER.md) | Bookmarks, history, passwords, sign-ins and settings from Chrome, Firefox and other browsers; saved passwords, addresses and form history suggested under the field; secure password store and password manager; bookmarks managed in Settings; mouse back and forward for the pane; tabs restored after a crash, browsing history, bookmarks that cannot be lost, drag tabs to reorder |

Features are numbered by area, for example 3.9 is the browser pane.

## Recommended order

1. **A notices file for bundled third-party work (6.4).** The Terms and Privacy links point to
   kucedr.com since 2026-11-24. Replies that survive leaving Home (5.3) were built 2026-11-21.
2. **Privacy: Privacy centre, encrypted data and app lock** (1.1, 1.3–1.4). Chats and memory sit
   unencrypted on disk today. Saved plugin credentials are decrypted in the main process, and
   the plugin detail page receives configured field names only (1.2).
3. **Agent efficiency.** Automatic compaction, Run insights, run budgets and lighter first messages
   (2.1–2.4) are built. Next, measure startup time, streaming smoothness and bundle size (2.7). Use that baseline
   to prioritize smooth streaming (2.5) and startup and sidebar work (2.6).
4. **Accessibility: screen-reader chat and full keyboard use** (4.1–4.2). A screen-reader user
   cannot follow a streamed reply today.
5. **User experience: search across chats** (3.2). Completion notifications (3.1) were built
   2026-11-21–22.
6. **Setup with a local model** (15.1), which is also the most private way to use the app.
7. **The first network shield pieces** (13.1, 13.3, 13.5, 13.8), which do not need the browser
   pane.
8. **Terminal back-end fixes** (14.1), before any terminal screen is built on it.

The user-experience area was chosen to be planned in detail first; see
[User experience in detail](EXPERIENCE.md#user-experience-in-detail).

## What depends on what

- The browser pane (3.9) comes before Tor (11) and private and VPN browsing (12), which live
  inside it. The network shield (13) applies to all of them.
- Encrypted backup (1.5) comes before Kucedr Storage (9.1) and encrypted sync (1.9).
- Payments (9) come before paid plugins sold in the catalogue (8.6).
- Signed builds (6.1) come before encrypted data and app lock protect fully (1.3, 1.4), and before
  paid plugins from outside authors (8.6, 8.7).
- How much a workspace separates (10) should be decided before the browser pane stores logins,
  and before memory (18) and integrations (17) gain per-workspace accounts.
- Legal pages (6.4) come before one-click Google and Microsoft sign-in (17.1) and before the first
  sale (9).
- A green test baseline (22.1) comes before new automatic checks (2.7, 4.5, 14.7).
- The terminal panel (14.2) comes before the terminal inside the coding page (20.3).
- Sealed credentials (1.2) and the workspace decision (10) come before imported passwords and
  sign-ins are stored (23.3–23.5).

## Not planned

- **A mobile or web companion.** Only encrypted sync (1.9) touches other devices.
- **A crash-reporting or analytics service.** The app sends no telemetry today.
- **Copy protection for paid plugins**, and a **VPN for the whole computer**.

## Constraints every detailed plan respects

- Provider and model behaviour stays in plugin manifests, not `src`.
- Saved data is upgraded by the app when it reads it, never by scripts editing `~/.kucedr`.
- New dependencies, tests and server migrations are called out as decisions, not assumed.
- Voice uses realtime models only ([Voice](VOICE.md)).
