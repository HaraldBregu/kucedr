# 13. Network shield

Part of the [Roadmap](README.md). Status: 13.3, 13.5, 13.11 and the WebRTC part of 13.6 built
2026-11-24 ([Browser routes and shield](../BROWSER_ROUTES.md)); on 2026-11-25 the tracking-parameter
part of 13.6, the first part of 13.7, the camera and microphone part of 13.13, and 13.14 for the
sign-in callback; on 2026-11-27 background browsing got the pane's request rules, WebSocket
checks, WebRTC policy and tracking-parameter stripping, and the tracker part of 13.1 was built
with the bundled EasyPrivacy list; the rest proposal.

Built: every browser pane session checks each request in `onBeforeRequest`
(`src/main/agent/tools/web/browser/guard.ts`, rules in `src/main/shield/`). Public pages cannot
reach the local network, including through a public name that resolves to a private address
(checked on direct and private tabs since 2026-11-27); stored keys and tokens never leave in an
address or request body, also for `fetch_web_page`, `search_web` and background browsing; downloads
wait in a holding folder for the user's answer. Blocked requests are listed per tab under the
toolbar's shield button. Background browsing calls the same `verdict` (`src/main/shield/verdict.ts`)
for every request and for WebSockets opened by pages and frames, not yet for WebSockets opened in
workers ([Browser routes and shield](../BROWSER_ROUTES.md#background-browsing-headless-chrome-in-background-runs)).
The "What exists today" list below is from 2026-11-19.

One set of rules for everything Kucedr sends and receives, enforced in the main process and shown
to the user, to protect the user's privacy. It protects Kucedr's own traffic; it is not a firewall
for the rest of the computer.

## What exists today

- **Web tools are allowed by default** with no per-site rule (`src/main/agent/agent_profiles.ts`).
  Approvals are per tool, never per site.
- **Shell commands can reach any site.** The agent's commands run in a sandbox with every domain
  allowed (`src/main/agent/sandbox.ts`). The sandbox already supports allow and deny lists.
- **Private-address blocking** exists (`src/main/public.ts`) for page fetches
  (`src/main/agent/tools/web/fetch_web_page.ts`) and background browsing, not for the interactive
  browser.
- **The interactive browser is unfiltered:** no request filtering, no tracker limits and no
  download handling. Background browsing already filters every request
  (`src/main/agent/tools/web/use_web_browser.ts`).
- **Web content reaches the model unmarked.** The only defence is one line in the system prompt
  (`src/main/agent/system/system_add_base_prompt.ts`). Page snapshots have no cap on the number of
  elements returned.
- **Workspace documents load remote images** when opened
  (`src/renderer/src/pages/workspace/Resource.ts`), so a file the agent writes can trigger a
  request. Assistant messages already turn remote images into links.
- **The app window's content policy is broad:** any `https:` image, any WebSocket and a CDN for
  scripts (`src/renderer/index.html`).
- **One listener:** the sign-in callback on fixed port 3001 (`src/main/mcp/redirect.ts`).
- **Not present:** a network log, a proxy setting, an offline switch, block lists. The app sends no
  telemetry.

## Outbound

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 13.1 | Tracker and ad blocking | The agent's browser blocks known trackers and ads; a counter shows what was blocked | The request filter background browsing already uses | M |
| 13.2 | Site rules | An allow list and a block list of sites for the agent, and an optional "ask before a new site" | Per-tool permissions in Settings → Assistant → Tools | M |
| 13.3 | Secret guard | A stored key or token never leaves in a search query, page request or form the agent fills; the action is stopped and shown | Exact match against the keys the app already stores ([Privacy](PRIVACY.md), 1.2) | S |
| 13.4 | Command and plugin limits | The agent's shell commands, plugin scripts and local connector servers reach only allowed sites | The sandbox's existing domain lists; the plugin `network:` permission is designed in [Plugin system](../PLUGIN_SYSTEM.md) but not built | M–L |
| 13.5 | Local network protection | Web pages cannot reach devices on the home or office network; `localhost` stays available for development when allowed | `src/main/public.ts`; [Security audit](../SECURITY_AUDIT.md) #21. Built 2026-11-24 for the pane. Background browsing, 2026-11-27: WebSockets from pages and frames are now checked too (`routeWebSocket`, same `verdict` plus `publicUrl`); checked in the built app with a scheduled task and a mock model (sockets to `127.0.0.1` and the LAN IP never reached the server, a control socket did). Left: WebSockets opened inside a worker are not checked | S |
| 13.6 | Browsing hygiene | HTTPS first, third-party cookies off, tracking parameters stripped from links, no network-address leak through WebRTC | Partly built. WebRTC: 2026-11-24. Tracking parameters, 2026-11-25: a pane navigation (main frame, GET) whose address carries `utm_*` or `…clid`/`…clkid` parameters, in any letter case, is redirected to the same address without them; other parameters keep their exact bytes and the fragment is untouched (`src/main/shield/strip.ts`, called inside the guard's try in `guard.ts`). Checked in a production build on direct and private tabs. Not built, by decision: HTTPS-first (a fallback to http from a failed upgrade broke a new tab's first page and left a dead entry in Back when measured on Electron 44) and third-party cookie blocking (Electron has no API for it; the Chromium switch that works is app-wide and would also block cookies in plugin app views). Background browsing, 2026-11-27: the same stripping (a 307 to the stripped address) and the direct tabs' WebRTC policy (`src/main/shield/webrtc.ts`, passed as `--webrtc-ip-handling-policy`; Chrome 158 ignores the `--force-` form). Checked in the built app: no ICE candidate gathered with mDNS hiding off, a LAN-IP host candidate without the switch; `?utm_source=x&keep=1&gclid=abc#frag` loaded as `?keep=1#frag` | S |
| 13.7 | Remote content in documents | Remote images in workspace documents load only when the user allows; a tighter content policy for the app window | First part built 2026-11-25. Remote images in workspace documents (viewer and editor), user messages and summary messages show a "Load image" button and load only after a click on that image (`components/remote-image.tsx`, `lib/remote.ts`); assistant messages already turned them into links. The app window's content policy lost its unused script CDN and websocket sources (`src/renderer/index.html`). Checked in a production build; the two review fixes (consent tied to the image address, summary messages) by typecheck and tests only. Left, M: drop `https:` images from the policy and let main fetch an image after the click; `'unsafe-inline'` and the any-path `local-resource:` handler stay ([Security audit](../SECURITY_AUDIT.md) #24, partial) | S |
| 13.8 | Network view | Per chat and overall: which sites were contacted, by which tool, and what was blocked | Tool inputs already recorded in each chat's `run.jsonl`; the Privacy centre ([Privacy](PRIVACY.md), 1.1) | M |
| 13.9 | Local-only switch | One switch that stops all traffic except the chosen model provider, or everything when a local model is used | [Local models and offline use](LOCAL.md) | M |

## Inbound

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 13.10 | Untrusted content marking | Web pages, search results and connector results are labelled as untrusted before the model reads them; hidden text is removed; snapshots are capped | The system-prompt line; the snapshot script in the browser tool | M |
| 13.11 | Download protection | Downloads are blocked or held until the user approves | No download handling today | S |
| 13.12 | Dangerous site blocking | Known phishing and malware sites are blocked from local lists | 13.1's list mechanism | S |
| 13.13 | Site permission prompts | Camera, microphone, location and notification requests from sites are denied unless the user allows | First part built 2026-11-25: a camera or microphone request shows a bar under the pane toolbar with Allow and Block; Allow covers that site in that tab until the page changes; nothing is remembered. Always denied with no bar: Tor tabs, tabs the agent opened, frames inside the page, location, notifications and every other permission. The permission check stays "denied", so a site that queries before asking may never ask. Checked in a production build with fake media devices (Allow, Block, navigation). Left: remembered answers per site in Settings → Browser, then location and notifications if wanted. Whole item M | M |
| 13.14 | Closed doors | Nothing listens except during a sign-in, on a random port; the network view states it | Built 2026-11-25 for the sign-in callback, which already opened only during a sign-in. Preset and typed client IDs keep port 3001 (OAuth apps registered with that exact address keep working); servers that register themselves get a free port on the first sign-in and reuse it from their stored registration afterwards (`src/main/mcp/redirect.ts`, `port.ts`, `ipc/mcp.ts`); retyping a client ID drops the old registration (`mcp_record_merge.ts`). Checked against a mock OAuth server in a production build and a focused script; no real provider sign-in. Still listening on this machine only: the command sandbox's proxy on 127.0.0.1 after the first sandboxed command. The network view part waits for 13.8 | S |

Inbound protection matters for outbound privacy: a page that can instruct the agent can ask it to
send data out. 13.10 and 13.3 work as a pair.

## Rules the design keeps

- **Every route.** The shield applies on direct, private, VPN and Tor tabs
  ([Private and VPN browsing](VPN.md), [Tor](TOR.md)).
- **Fails closed.** If a rule cannot be checked, the request is blocked.
- **Local lists.** Block lists are stored and matched on the machine; no address is sent to a
  checking service.
- **One decision point.** Browser, page fetch, search, shell and plugins ask the same rule set, so
  a site blocked in one is blocked in all.

## Open decisions

- **Default level.** Recommended: Standard (block trackers, guard secrets, protect the local
  network, log everything) with Strict as a choice (ask before each new site, allow list only).
  Asking for every site by default would make the agent tiresome.
- **Block lists.** Which community lists to ship, and their licences, need checking before
  bundling.
- **First step.** 13.1, 13.3, 13.5 and 13.8 work without the browser pane; the pane (3.9) later
  shows the shield's state.
- **Where filtering happens.** The browser pane is planned as a separate web view with its own
  network session ([Embedded agent browser plan](../AGENT_BROWSER_PLAN.md)), which is the hook for
  filtering, cookies, downloads and site permissions. Until the pane exists, the first pieces apply
  to page fetches, search, shell commands and background browsing.
