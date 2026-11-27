# 11. Tor and .onion sites

Part of the [Roadmap](README.md). Status: 11.1–11.3 built 2026-11-24
([Browser routes and shield](../BROWSER_ROUTES.md)); `.onion` kept off the normal DNS 2026-11-27;
11.4 proposal.

The agent's browser can open `.onion` addresses, shown in the browser pane like any other page.

## What exists today

- **Tor tabs (11.1, 11.3).** A pane tab can use the `tor` route: its own in-memory session sent
  through `socks5://` to Tor, with no direct fallback and loopback not bypassed. Opened from the
  pane's mask button or by the agent (`use_web_browser` `open` with `route: "tor"`, which always
  asks the user). Checked against a fake SOCKS5 server: host names, `.onion` included, reach the
  proxy as names, and a stopped proxy fails the tab.
- **Tor connection (11.2).** Settings → Browser → Connections: an address, or automatic (Tor
  Browser on 9150, then the Tor service on 9050), with a Check button.
- Downloads are off, saved passwords are not offered, nothing is kept or restored, and pages get
  60 s instead of 15 s.
- Not checked against a real Tor yet. Background runs still have no Tor.

Tor Browser itself cannot be embedded in Kucedr or driven by the agent. What works is sending the
agent's own browser through the Tor network, which is what reaches `.onion` sites.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 11.1 | Tor tabs | `.onion` addresses open in a tab that connects through Tor, marked with a Tor indicator in the pane's toolbar | Browser pane (3.9); a tab whose network session is routed through Tor | M |
| 11.2 | Tor connection | Kucedr finds Tor already running on the machine (Tor Browser or the Tor service) and shows its status in Settings; an address field for a custom setup | Nothing to bundle | S |
| 11.3 | Open any site through Tor | A per-tab choice to load an ordinary site through Tor, for the user or when the user asks the agent to | 11.1 | S |
| 11.4 | Built-in Tor | Tor ships inside Kucedr and starts on demand, so nothing has to be installed | Adds a program to ship, sign and keep updated on three platforms | L |

Tor tabs share one mechanism with private and VPN tabs; see
[Private and VPN browsing](VPN.md).

## Rules the design keeps

- **Separate and disposable.** Tor tabs use their own profile, never the one holding the user's
  logins, and it is wiped when the Tor session ends.
- **No fallback.** If Tor is not running or drops, a Tor tab fails. It never retries over the normal
  connection. Address lookups also go through Tor.
- **Downloads off** in Tor tabs.
- **Approval.** The first time a chat opens a Tor tab, the user approves it; existing tool approvals
  still apply.
- **Interactive only.** Background and scheduled runs do not use Tor in the first version. Their
  address check in `src/main/public.ts` rejects `.onion` today, which is the right default.
- **Slower pages.** Tor tabs get longer time limits than the tool's default.

## What the user must be told, in the app

- This is not Tor Browser. Sites cannot see the user's network address, but Kucedr's browser
  is easier to recognise than Tor Browser, so it should not be described as anonymous.
- Only the browser goes through Tor. The text the agent reads from a page is still sent to the model
  provider, and search, other tools and the model connection use the normal network.

## Open decisions

- **Where Tor comes from.** Recommended: 11.2 first (use Tor already on the machine) and 11.4 only
  if people ask for it.
- **Order.** After the browser pane (3.9), since the indicator and tabs live there.
- **Blocked networks.** Tor is restricted or blocked in some countries; bridges for those networks
  are left out of the first version.
