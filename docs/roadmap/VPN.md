# 12. Private and VPN browsing

Part of the [Roadmap](README.md). Status: 12.1, 12.2 and the route indicator of 12.4 built
2026-11-24 ([Browser routes and shield](../BROWSER_ROUTES.md)); 12.3 and the per-workspace default
proposal.

The agent's browser can browse privately, leaving nothing behind, and through a VPN so sites do not
see the user's network address.

## What exists today

- **Private tabs (12.1).** Each private tab has its own in-memory session (shared only with its
  popups), wiped when its last tab closes, kept out of history and tab restore, and never offered
  saved passwords.
- **Proxy tabs (12.2).** Settings → Browser → Connections takes `socks5://host:port` or
  `http://host:port`. Proxy tabs use it with no direct fallback. Proxies that need a username and
  password are not supported yet (Chromium's SOCKS client has no password support).
- **Route indicator (12.4).** The tab strip shows a route icon and the toolbar a Private, Tor or
  Proxy badge with what the route covers.
- Direct tabs keep the one permanent profile with the user's logins. If the user already runs a
  VPN for the whole computer, the browser goes through it with no work from Kucedr.

A VPN for the whole computer needs operating-system permission (on macOS a special entitlement from
Apple and signed builds) and is a different product. What Kucedr can do itself is route its own
browser through a VPN connection, leaving the rest of the machine untouched.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 12.1 | Private tabs | A tab with no saved history, cookies or logins, wiped when closed; the agent can open one when asked | Browser pane (3.9); same disposable profile as Tor tabs (11.1) | S |
| 12.2 | Browse through a proxy | The user enters the proxy address their VPN provider gives them; chosen tabs, or every tab, go through it | Same mechanism as Tor tabs: a tab whose network session uses a different connection | S |
| 12.3 | Browse through a VPN profile | Import a WireGuard file from any VPN provider; the browser pane uses it, with no administrator rights and no effect on other apps | Needs a small bundled VPN program, shipped and updated like built-in Tor (11.4) | L |
| 12.4 | Route indicator and per-workspace default | The toolbar shows how each tab connects: direct, private, VPN or Tor. A workspace can default to one, for example work always through the company proxy | Browser pane toolbar; [Multiple workspaces](WORKSPACES.md) | S |
| 12.5 | Proxy profiles with login | Several named proxies (address, port, username, password), chosen per tab or as a case's default route, for example a regional proxy from the investigator's own provider. The password is sealed and never reaches the agent | Today one proxy address with no login (`src/main/browser/connections.ts`); Electron's `login` event answers proxy authentication; sealed storage ([Privacy](PRIVACY.md), 1.2). Proposal 2026-11-27 for the [investigation desk](../mission/TARGET.md) | S–M |

## One mechanism with Tor

Each tab has a route: direct, private, VPN or Tor. The browser pane is planned as a
separate web view per tab ([Embedded agent browser plan](../AGENT_BROWSER_PLAN.md)), and each view
has its own network session. A private, VPN or [Tor](TOR.md) tab is a tab whose session is
disposable and uses the chosen connection. Building it once covers both areas.

## Rules the design keeps

- **No fallback.** If the VPN or proxy drops, the tab fails and never reloads over the direct
  connection. Address lookups go through the same route.
- **Separate profile.** Private and VPN tabs never share the profile that holds the user's logins.
- **Only the browser is routed.** What the agent reads is still sent to the model provider, and
  search, other tools and the model connection use the normal network. The app says so where the
  route is chosen.

## Open decisions

- **Whose VPN.** Recommended: bring-your-own first (12.2, then 12.3), so the user connects the VPN
  service they already pay for. Selling a Kucedr VPN through [Payments](PAYMENTS.md) means running
  exit servers and handling abuse reports and legal requests, which is a business of its own; a
  partnership with an existing provider is the lighter way to offer it later.
- **First step.** 12.1 and 12.2 are small once the browser pane exists and deliver most of the
  value; 12.3 only if proxy addresses prove too awkward for users.
- **VPN credentials** are stored like other secrets ([Privacy](PRIVACY.md), 1.2).
