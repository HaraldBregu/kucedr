# 11. Tor and .onion sites

Part of the [Roadmap](README.md). Status: proposal.

The agent's browser can open `.onion` addresses, shown in the browser pane like any other page.

## What exists today

Nothing. The browser tool starts the user's installed Google Chrome with a direct connection
(`src/main/agent/tools/web/use_web_browser.ts`); there is no proxy or Tor handling anywhere in
`src/main`.

Tor Browser itself cannot be embedded in Kucedr or driven by the agent. What works is sending the
agent's own browser through the Tor network, which is what reaches `.onion` sites. The browser pane
is planned as a separate web view per tab, each with its own network session
([Embedded agent browser plan](../AGENT_BROWSER_PLAN.md)), so a Tor tab is a tab whose session is
routed through Tor.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 11.1 | Tor tabs | `.onion` addresses open in a tab that connects through Tor, marked with a Tor indicator in the pane's toolbar | Browser pane (3.9); a second browser instance started with a Tor connection | M |
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

- This is not Tor Browser. Sites cannot see the user's network address, but Chrome is easier to
  recognise than Tor Browser, so it should not be described as anonymous.
- Only the browser goes through Tor. The text the agent reads from a page is still sent to the model
  provider, and search, other tools and the model connection use the normal network.

## Open decisions

- **Where Tor comes from.** Recommended: 11.2 first (use Tor already on the machine) and 11.4 only
  if people ask for it.
- **Order.** After the browser pane (3.9), since the indicator and tabs live there.
- **Blocked networks.** Tor is restricted or blocked in some countries; bridges for those networks
  are left out of the first version.
