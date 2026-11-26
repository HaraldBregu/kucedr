# Roadmap

Status: proposal, written 2026-11-19. Built since: the long-chat streaming measurement (2.5), storage management (1.7), sealed credentials on disk (1.2), the first
release of app-wide Privacy Mode (1.10), the backup portability warning (1.12), the first four agent efficiency
features ([2.1–2.4](PERFORMANCE.md)), a chat list that updates on change (2.6), the performance
check (2.7), completion
notifications (3.1), search across chats (3.2), regenerate and retry (3.3), the full "/" menu
(3.4), offline and failure states (3.6, 15.4), undo and the archive view (3.7), attachment checks
(3.8), the browser pane (3.9), the agent cursor (3.11), browser control from the chat (3.12) and most of
browser import
(23), screen-reader chat, keyboard use, high contrast and named controls (4.1–4.4), update
channels and crash recovery (5.1, 5.2), replies that survive leaving Home (5.3), the legal pages and third-party notices (6.4), setup with a local model (15.1), the task form, failed-run notices and
task limits (16.1, 16.3, 16.5), seeing and editing memory and remembering in chat (18.1, 18.2),
fast knowledge retrieval (18.6), knowledge sources at a glance (18.4), the honest model catalogue (8.9), the one-time browser import offer (23.1), voice mute, status and transcripts (19.1, 19.2),
private, Tor and proxy tabs with the first network shield pieces (11.1–11.3, 12.1, 12.2, 13.3,
13.5, 13.11, part of 13.6), first parts of 13.7 and 13.13, the sign-in callback port (13.14), most
of the terminal back end (14.1), desktop plugin archive limits (21.4), and a green test baseline
(22.1); each
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
| 3 | [User experience](EXPERIENCE.md) | Notifications, search across chats, regenerate, "/" menu, shortcut guide, failure states, undo, attachment checks, browser pane, chat export and import, agent cursor in the browser pane, browser control from the chat, interface polish (in-app confirmations, empty and loading states, visual consistency, a useful empty chat, smoother setup, find any setting) |
| 4 | [Accessibility](ACCESSIBILITY.md) | Screen-reader chat, full keyboard use, high contrast and text size, named controls, automatic checks |
| 5 | [Reliability and updates](RELIABILITY.md) | Stable and beta channels, crash recovery, replies that survive leaving Home |
| 6 | [Distribution and trust](DISTRIBUTION.md) | Signed builds, website and user docs, arm64 builds, legal pages, published CLI and SDK |
| 7 | [Languages](LANGUAGES.md) | Complete Italian, more languages |
| 8 | [Plugins](PLUGINS.md) | Catalogue, sign-in (OAuth) for plugins, paid plugins, app bridge |
| 9 | [Payments and paid services](PAYMENTS.md) | Kucedr Storage, plans and checkout, entitlements, subscription management |
| 10 | [Workspaces and windows](WORKSPACES.md) | Workspaces from a picked folder and switcher, separate chats, memory and sign-ins, a workspace per window, open in new window, work that continues in the background |
| 11 | [Tor and .onion sites](TOR.md) | Tor tabs in the browser pane |
| 12 | [Private and VPN browsing](VPN.md) | Private tabs, proxy and VPN routes for the browser pane |
| 13 | [Network shield](SHIELD.md) | Tracker blocking, site rules, secret guard, local network protection, network view, untrusted content marking, download protection |
| 14 | [Terminal](TERMINAL.md) | Back-end fixes, terminal panel, tabs, clean environment, terminal and chat together |
| 15 | [Local models and offline use](LOCAL.md) | Setup with a local model, model downloads, local knowledge, offline behaviour |
| 16 | [Automation](AUTOMATION.md) | Create and edit tasks, run history, failures surfaced, catch-up, health results |
| 17 | [Integrations](INTEGRATIONS.md) | One-click Google and Microsoft sign-in, complete mail tools, connector management |
| 18 | [Memory and knowledge](MEMORY.md) | See and edit memory, remember and forget in chat, knowledge sources at a glance, fast knowledge retrieval |
| 19 | [Voice](VOICE.md) | Mute and status, transcripts where available, approvals by voice |
| 20 | [Coding page](CODING.md) | Ship or remove the coding page, same permission rules, terminal inside coding, more coding harnesses (Claude, Codex, OpenCode, Cursor, Antigravity, Grok Build, Devin CLI, Pi, Oh My Pi, Factory Droid), coding agent as a chat tool with live progress, approvals and steering |
| 21 | [Security hardening](SECURITY.md) | The security audit items still open |
| 22 | [Quality](QUALITY.md) | Green tests, coverage in CI, real-app checks, docs that match the app |
| 23 | [Browser import](BROWSER.md) | Bookmarks, history, passwords, sign-ins and settings from Chrome, Firefox and other browsers; saved passwords, addresses and form history suggested under the field; secure password store and password manager; bookmarks managed in Settings; mouse back and forward for the pane; tabs restored after a crash, browsing history, bookmarks that cannot be lost, drag tabs to reorder |
| 24 | [Computer use](COMPUTER.md) | Desktop driver, computer tool, permissions setup, approval and Stop, one chat at a time, background control, screenshots to the model, provider computer tools, screen text marked untrusted, separate computer |

Features are numbered by area, for example 3.9 is the browser pane.

## Recommended order

1. **Small items left from the 2026-11-25 list:** Built since: long-chat streaming measurement (2.5), storage management (1.7), redaction length in
   approval cards (21.12), legal pages and notices (6.4), offline
   and failure states (3.6, 15.4), voice status (19.1, 19.2), and parts of the shield (13.6, 13.7,
   13.13, 13.14).
2. **Privacy: Privacy centre, encrypted data and app lock** (1.1, 1.3–1.4). Chats and memory sit
   unencrypted on disk today. Saved plugin credentials are decrypted in the main process, and
   the plugin detail page receives configured field names only (1.2).
3. **Agent efficiency.** Automatic compaction, Run insights, run budgets and lighter first messages
   (2.1–2.4) are built, and so are the sidebar update on change (2.6) and the performance check
   (2.7). Next, a smaller first renderer chunk (4 MB today) for start time, and a long-chat
   measurement before any streaming work (2.5).
4. **Accessibility checks** (4.5), once its two development dependencies are approved and
   `eslint-plugin-jsx-a11y` supports ESLint 10. Screen-reader chat, full keyboard use, high
   contrast and named controls (4.1–4.4) were built 2026-11-24.
5. **User experience: shortcut guide** (3.5), then the interface polish, starting with in-app
   confirmations and empty states (3.13, 3.14). Search across chats (3.2) and the "/" menu (3.4)
   were built 2026-11-25.
6. **Model downloads** (15.2). Setup with a local model (15.1) and offline behaviour (15.4) were
   built 2026-11-25.
7. **The next network shield pieces**: tracker blocking (13.1) and the network view (13.8). The
   secret guard (13.3) and local network protection (13.5) were built 2026-11-24.
8. **The rest of the terminal back end**: flow control and kept history (14.1) and a clean
   environment (14.4), before any terminal screen is built on it. Most of 14.1 was built
   2026-11-25.

The user-experience area was chosen to be planned in detail first; see
[User experience in detail](EXPERIENCE.md#user-experience-in-detail).

## What depends on what

- The browser pane (3.9) comes before Tor (11) and private and VPN browsing (12), which live
  inside it. The network shield (13) applies to all of them.
- Encrypted backup (1.5) comes before Kucedr Storage (9.1) and encrypted sync (1.9).
- Payments (9) come before paid plugins sold in the catalogue (8.6).
- Signed builds (6.1) come before encrypted data and app lock protect fully (1.3, 1.4), and before
  paid plugins from outside authors (8.6, 8.7).
- Workspaces and windows (10) are built as one sequence: a window is where a workspace is shown.
  They come before memory (18) and integrations (17) gain per-workspace accounts. How much a
  workspace separates was decided 2026-11-26: everything that holds content.
- Legal pages (6.4) come before one-click Google and Microsoft sign-in (17.1) and before the first
  sale (9).
- A green test baseline (22.1) comes before new automatic checks (2.7, 4.5, 14.7).
- The terminal panel (14.2) comes before the terminal inside the coding page (20.3).
- Sealed credentials (1.2) and the workspace decision (10) come before imported passwords and
  sign-ins are stored (23.3–23.5).
- Signed builds (6.1) come before computer use on macOS (24.3), because Accessibility and Screen
  Recording grants do not hold across unsigned updates.
- Untrusted content marking (13.10) comes before the agent acts on what it reads from the screen
  (24.2, 24.9).
- Model downloads (15.2) come before a separate computer (24.10).

## Not planned

- **A mobile or web companion.** Only encrypted sync (1.9) touches other devices.
- **A crash-reporting or analytics service.** The app sends no telemetry today.
- **Copy protection for paid plugins**, and a **VPN for the whole computer**.

## Constraints every detailed plan respects

- Provider and model behaviour stays in plugin manifests, not `src`.
- Saved data is upgraded by the app when it reads it, never by scripts editing `~/.kucedr`.
- New dependencies, tests and server migrations are called out as decisions, not assumed.
- Voice uses realtime models only ([Voice](VOICE.md)).
