# 13. Network shield

Part of the [Roadmap](README.md). Status: 13.3, 13.5, 13.11 and the WebRTC part of 13.6 built
2026-11-24 ([Browser routes and shield](../BROWSER_ROUTES.md)); on 2026-11-25 the tracking-parameter
part of 13.6, the first part of 13.7, the camera and microphone part of 13.13, and 13.14 for the
sign-in callback; on 2026-11-27 background browsing got the pane's request rules, WebSocket
checks, WebRTC policy and tracking-parameter stripping, the tracker part of 13.1 was built
with the bundled EasyPrivacy list, the malware part of 13.12 with a bundled URLhaus list, and
13.3 extended to the agent's type, fill, select, wait and evaluate actions, and 13.10 built; the
rest proposal.

Built: every browser pane session checks each request in `onBeforeRequest`
(`src/main/agent/tools/web/browser/guard.ts`, rules in `src/main/shield/`). Public pages cannot
reach the local network, including through a public name that resolves to a private address
(checked on direct and private tabs since 2026-11-27); stored keys and tokens never leave in an
address or request body, also for `fetch_web_page`, `search_web` and background browsing; downloads
wait in a holding folder for the user's answer. Blocked requests are listed per tab under the
toolbar's shield button. Background browsing calls the same `verdict` (`src/main/shield/verdict.ts`)
for every request and for WebSockets opened by pages and frames, not yet for WebSockets opened in
workers ([Browser routes and shield](../BROWSER_ROUTES.md#background-browsing-headless-chrome-in-background-runs)).
Since 2026-11-27 the same `verdict` blocks third-party requests to tracker hosts from the bundled
EasyPrivacy list, on every pane route and in background browsing, and every request, page loads
included, to known malware hosts (13.12); `fetch_web_page` and the agent's `use_web_browser`
refuse those hosts with a clear error. Since 2026-11-27 `use_web_browser` also refuses an act
whose typed text, field values, select values, wait selector or script carries a stored key or
token, before it reaches the page, so the key cannot leave through a channel the request check
cannot read.
The "What exists today" list below is from 2026-11-19, except the block-list and secret-guard lines.

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
- **Web and connector content is marked (2026-11-27).** Results of the web tools and MCP tools
  reach the model inside an `<untrusted_content source="…">` envelope, with a system-prompt rule
  that it is data; hidden text is dropped from snapshots and page fetches; snapshots list at most
  200 elements (13.10).
- **Workspace documents load remote images** when opened
  (`src/renderer/src/pages/workspace/Resource.ts`), so a file the agent writes can trigger a
  request. Assistant messages already turn remote images into links.
- **The app window's content policy is broad:** any `https:` image, any WebSocket and a CDN for
  scripts (`src/renderer/index.html`).
- **One listener:** the sign-in callback on fixed port 3001 (`src/main/mcp/redirect.ts`).
- **Not present:** a network log, a proxy setting, an offline switch, block lists. The app sends no
  telemetry. Since 2026-11-27 two block lists ship in `resources/shield/`: EasyPrivacy and a
  URLhaus malware host list, read from disk only, never fetched by the app.
- **Secret guard on agent input (2026-11-27):** stored keys and tokens are checked in request
  addresses and bodies, and in the text of the agent's type, fill, select, wait and evaluate actions
  (`src/main/agent/tools/web/browser/secret.ts`).

## Outbound

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 13.1 | Tracker and ad blocking | The agent's browser blocks known trackers and ads; a counter shows what was blocked | Trackers built 2026-11-27. The EasyPrivacy list (`resources/shield/easyprivacy.txt`, downloaded 2026-11-27, version 202611271330, updated with releases, never fetched at runtime) is parsed once, on the first third-party subresource request, into host sets (`src/main/shield/list.ts`). Used: `\|\|host^` block rules with no option, `$third-party` and type options (`script`, `image`, `xmlhttprequest`, `subdocument`, `ping`, `websocket`, …, also negated); `@@\|\|host^` exceptions with the same options. Skipped: rules with `domain=`, `~third-party` or any other option, path, wildcard, regex and cosmetic rules (47,494 block hosts and 10 exceptions used). A request is blocked (reason `tracker`) when its host or a parent domain is listed for its type, no exception covers it, it is not a main-frame load, and its registrable domain (`tldts`, public suffix list) differs from the top page's; an unknown or non-web top page counts as third-party (`src/main/shield/tracker.ts`, called last in `verdict`). Pane: every route; background browsing: every request, and WebSockets judged with no top page. The shield button counts tracker requests per page, and its list shows each tracker origin once (en, it). On by default with no setting, since Settings → Browser has no shield options. Checked in the built app with `--host-resolver-rules` and a local server: a page on `site-a.example.test` loading two scripts, an iframe and a `fetch` from listed hosts had all four blocked and counted, on direct, private and proxy tabs (the logging SOCKS5 server never saw the tracker host) and in background browsing; the same host opened as the page loaded its script; an image from a host listed for scripts and XHR only was let through. Tor tabs share the proxy tabs' path; not run without Tor. Ceilings: the top page is the tab's committed address, so a request sent before a new page commits is judged against the old one; a frame's requests are judged against the top page, not the frame; rules without `$third-party` still block only third-party requests; ads (EasyList) not shipped | M |
| 13.2 | Site rules | An allow list and a block list of sites for the agent, and an optional "ask before a new site" | Per-tool permissions in Settings → Assistant → Tools | M |
| 13.3 | Secret guard | A stored key or token never leaves in a search query, page request or form the agent fills; the action is stopped and shown | Exact match against the keys the app already stores ([Privacy](PRIVACY.md), 1.2). Built 2026-11-24 for request addresses and bodies. Agent input, 2026-11-27: `use_web_browser` act refuses any kind whose `text`, `fill` field values, `select` values, `wait` selector or `evaluate` script carries a stored key, as is or URL-encoded (the same `leaks` check, `src/main/agent/tools/web/browser/secret.ts`), before anything reaches the page, in the pane (`act.ts`) and in background browsing (`runAct`), with "Blocked: the action contains a stored key or token…". In the pane each refusal is added to the tab's shield list as "Stored key or token" with the page's site; background browsing has no shield list. If reading the stored keys throws, the action fails with that error (by code reading, not run). Checked in the built app with a mock model, a placeholder key saved as a provider key in an isolated profile and a local form on `site-a.example.test` (`--host-resolver-rules`): type with submit, fill, an evaluate posting the key with `fetch` and an evaluate opening a WebSocket with the key were all refused in the pane and in background browsing, the pane's shield list showed four entries, and the server got no request with the key; a control type of `hello` with submit posted `q=hello`. In the pane, `select` values and the `wait` selector run in the page's own script world, so a page that wraps `Array.prototype.includes` and `querySelector` read them; before the fix such a page sent the key out base64-encoded, past the request check. After it, the same run refused a `select` of the key and a `wait` for a selector holding it, in the pane (two shield list entries) and in background browsing, the page sent nothing, and a control `select` of `b` and `wait` for `input` worked. Ceilings: a key the agent splits, encodes otherwise or builds inside the script is not caught (exact match only); `press` takes one key or a named key, too short to hold a stored key; the page's own scripts are not checked | S |
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
| 13.12 | Dangerous site blocking | Known phishing and malware sites are blocked from local lists | Malware built 2026-11-27. List: `resources/shield/urlhaus.txt`, the "Online Malicious Domains Blocklist" of the urlhaus-filter project (CC0, built from abuse.ch URLhaus data), downloaded 2026-11-27 (list time 12:10 UTC), 1,973 hosts (619 names, 1,354 IPv4 addresses), updated with releases, never fetched at runtime. abuse.ch's own hostfile answered 410 Gone (its exports need an account key since 2026-10-21), so this derived list is used; it leaves out popular sites. Read once into a set (`src/main/shield/hosts.ts`); exact host match, no parent domains, an IPv4-mapped IPv6 address is matched as its IPv4 (`dangerous.ts`). A missing or empty list throws, so the request is blocked. `verdict` returns `dangerous` for every request type, page loads included, as its last check, after the local-network, secret and tracker checks, so a pass never skips those: pane on every route, background browsing for every request and WebSocket. Pane: a blocked page load (typed, link, redirect) shows a warning in place of the page with the site and a "Continue anyway" button (`Danger.tsx`, en, it). Continue lets that host through in that tab for the user only: the button is disabled while the agent acts, the guard ignores the pass while the agent acts, and the pass is dropped as soon as the agent uses the tab (`run.ts`). Agent: `use_web_browser` open and navigate (pane and background) and `fetch_web_page` (on every redirect hop) fail with "Blocked: <host> is on the bundled list of known malware sites…" (`refuse.ts`); `search_web` results are not filtered, opening one goes through these checks. Background browsing also maps the listed names to `~NOTFOUND` in headless Chrome's `--host-resolver-rules` (`sinkhole.ts`), because Playwright's route handler is not called for redirect hops. Checked in the built app, with `--host-resolver-rules` mapping the listed `zhikey.com` to a local server: on direct, private and proxy tabs a typed address and a redirect showed the warning (en and it, page view hidden), an image, a script and a `fetch` from the host were blocked, and neither the server nor the logging SOCKS5 server saw the host; Continue anyway loaded the page; in a chat with a mock model, open and `fetch_web_page` returned the error and a `location.href` to the host on the user's passed tab was blocked; in background browsing open, subresources, a script navigation and a redirect were blocked (the redirect fails as `ERR_NAME_NOT_RESOLVED`). Tor tabs share the proxy tabs' path; not run without Tor. Phishing not built: Phishing.Database is MIT licensed, but it names no upstream feeds, so whether its data may be redistributed is unclear; its download also answered 503 on 2026-11-27. Ceilings: in background browsing a redirect to a listed IP address is followed (resolver rules match names only); a first run without the resolver rules reached the listed host through a redirect, so the route handler never sees a redirect hop and the local-network and stored-key rules are not applied to one either (not fixed here) | S |
| 13.13 | Site permission prompts | Camera, microphone, location and notification requests from sites are denied unless the user allows | First part built 2026-11-25: a camera or microphone request shows a bar under the pane toolbar with Allow and Block; Allow covers that site in that tab until the page changes; nothing is remembered. Always denied with no bar: Tor tabs, tabs the agent opened, frames inside the page, location, notifications and every other permission. The permission check stays "denied", so a site that queries before asking may never ask. Checked in a production build with fake media devices (Allow, Block, navigation). Left: remembered answers per site in Settings → Browser, then location and notifications if wanted. Whole item M | M |
| 13.14 | Closed doors | Nothing listens except during a sign-in, on a random port; the network view states it | Built 2026-11-25 for the sign-in callback, which already opened only during a sign-in. Preset and typed client IDs keep port 3001 (OAuth apps registered with that exact address keep working); servers that register themselves get a free port on the first sign-in and reuse it from their stored registration afterwards (`src/main/mcp/redirect.ts`, `port.ts`, `ipc/mcp.ts`); retyping a client ID drops the old registration (`mcp_record_merge.ts`). Checked against a mock OAuth server in a production build and a focused script; no real provider sign-in. Still listening on this machine only: the command sandbox's proxy on 127.0.0.1 after the first sandboxed command. The network view part waits for 13.8 | S |
| 13.15 | Ads, pop-ups and cookie banners removed | Pages in the browser pane open without ads, pop-up windows, overlays or cookie consent banners. Added 2026-11-27 | 13.1's list mechanism, which ships trackers only: an ad list (EasyList), cosmetic (element-hiding) rules, which the parser skips today, and a cookie-banner list are all new. Open: whether a banner is hidden or answered with "reject" | M |

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
- **Block lists.** Resolved 2026-11-27: EasyPrivacy, bundled as a separate data file under CC BY-SA
  3.0 (it is dual licensed with GPL-3.0), credited in `THIRD_PARTY_NOTICES.md`, updated with
  releases. 13.12 ships the urlhaus-filter malware list (CC0), credited the same way. Ad lists
  (EasyList) and a phishing list are still open.
- **First step.** 13.1, 13.3, 13.5 and 13.8 work without the browser pane; the pane (3.9) later
  shows the shield's state.
- **Where filtering happens.** The browser pane is planned as a separate web view with its own
  network session ([Embedded agent browser plan](../AGENT_BROWSER_PLAN.md)), which is the hook for
  filtering, cookies, downloads and site permissions. Until the pane exists, the first pieces apply
  to page fetches, search, shell commands and background browsing.
