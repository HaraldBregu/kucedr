# Roadmap

Status: proposal, written 2026-11-19. Nothing here is implemented. Each feature gets its own
detailed plan before any implementation starts.

This folder lists the features proposed for Kucedr, one file per area. Each file says what the user
gets, what already exists to build on, a rough size, and the decisions still open. Statements about
current behaviour come from a read of the checkout on the date above; items marked _(not verified)_
or _(not measured)_ were read from code or docs and not confirmed in the running app.

Size is a rough guide: **S** a few days, **M** one to two weeks, **L** more than that or dependent
on an outside decision.

## Areas

| # | Area | Features |
| --- | --- | --- |
| 1 | [Privacy](PRIVACY.md) | Privacy centre, sealed credentials, encrypted data, app lock, encrypted backup, private chat, storage management, account deletion, encrypted sync |
| 2 | [Performance and agent efficiency](PERFORMANCE.md) | Automatic compaction, run insights, run budgets, lighter first message, smooth streaming, instant start, performance check, spend tracking |
| 3 | [User experience](EXPERIENCE.md) | Notifications, search across chats, regenerate, "/" menu, shortcut guide, failure states, undo, attachment checks, browser pane |
| 4 | [Accessibility](ACCESSIBILITY.md) | Screen-reader chat, full keyboard use, high contrast and text size, named controls, automatic checks |
| 5 | [Reliability and updates](RELIABILITY.md) | Stable and beta channels, crash recovery |
| 6 | [Distribution and trust](DISTRIBUTION.md) | Signed and notarised builds, website and user docs |
| 7 | [Languages](LANGUAGES.md) | Complete Italian, more languages |
| 8 | [Plugins](PLUGINS.md) | Catalogue, sign-in (OAuth) for plugins, paid plugins |
| 9 | [Payments and paid services](PAYMENTS.md) | Kucedr Storage, plans and checkout, entitlements, subscription management |
| 10 | [Multiple workspaces](WORKSPACES.md) | Workspaces and switcher, separate chats, memory and sign-ins |
| 11 | [Tor and .onion sites](TOR.md) | Tor tabs in the browser pane |
| 12 | [Private and VPN browsing](VPN.md) | Private tabs, proxy and VPN routes for the browser pane |

Features are numbered by area, for example 3.9 is the browser pane.

## Recommended order

1. **Privacy: Privacy centre, sealed credentials, encrypted data** (1.1–1.4). Chats, memory and
   model API keys sit unencrypted on disk today.
2. **Agent efficiency: automatic compaction and run insights** (2.1–2.2). Measured rounds show
   turn count and prompt size are the remaining levers, and the user cannot see either.
3. **Accessibility: screen-reader chat and full keyboard use** (4.1–4.2). A screen-reader user
   cannot follow a streamed reply today.
4. **User experience: completion notifications and search across chats** (3.1–3.2).

The user-experience area was chosen to be planned in detail first; see
[User experience in detail](EXPERIENCE.md#user-experience-in-detail).

## What depends on what

- The browser pane (3.9) comes before Tor (11) and private and VPN browsing (12), which live
  inside it.
- Encrypted backup (1.5) comes before Kucedr Storage (9.1) and encrypted sync (1.9).
- Payments (9) come before paid plugins sold in the catalogue (8.6).
- Signed builds (6.1) come before encrypted data and app lock protect fully (1.3, 1.4), and before
  paid plugins from outside authors (8.6, 8.7).
- How much a workspace separates (10) should be decided before the browser pane stores logins.

## Constraints every detailed plan respects

- Provider and model behaviour stays in plugin manifests, not `src`.
- Saved data is upgraded by the app when it reads it, never by scripts editing `~/.kucedr`.
- New dependencies, tests and server migrations are called out as decisions, not assumed.
