# Browser Routes and Shield — Plan

> **Status:** plan and build, 2026-11-24; background browsing given the same shield 2026-11-27; tracker blocking 2026-11-27. Roadmap: [Tor](roadmap/TOR.md) 11.1–11.3, [Private and VPN browsing](roadmap/VPN.md) 12.1, 12.2, 12.4 (without the workspace default), [Network shield](roadmap/SHIELD.md) 13.1 (trackers), 13.3, 13.5, 13.6 (WebRTC and tracking parameters), 13.11.

## Scope

Each browser pane tab has a **route**: `direct` (today's tabs), `private`, `tor` or `proxy`. The route is fixed when the tab opens. One request check (the shield) runs on every pane session.

Not in this pass: ad blocking (the ad part of 13.1), untrusted content marking (13.10), the network view (13.8, waits for the Privacy centre), built-in Tor (11.4), WireGuard profiles (12.3), proxies that need a username and password (Chromium's SOCKS client has no password support; HTTP proxy sign-in comes later), and routes in background runs.

## Routes

| Route | Session | Connection | Saved |
| --- | --- | --- | --- |
| `direct` | `persist:agent-browser`, shared by all direct tabs | Direct | Logins, history, restored after restart |
| `private` | Its own in-memory session per tab (popups share it) | Direct | Nothing. Wiped when its last tab closes |
| `tor` | Same as private | `socks5://` to Tor, no fallback, loopback not bypassed | Nothing |
| `proxy` | Same as private | The proxy from Settings, no fallback | Nothing |

- Tor comes from the machine: the address in Settings, else the first of `127.0.0.1:9150` (Tor Browser) and `127.0.0.1:9050` (Tor service) that answers a SOCKS5 greeting.
- A routed session blocks every request until its proxy is applied, and stays blocked if Tor or the proxy cannot be set. Chromium with `fixed_servers` does not fall back to direct.
- `socks5://` sends host names to the proxy, so names (including `.onion`) are not looked up on the user's connection. Checked 2026-11-27 in the built app with a logging SOCKS5 server: a proxy tab sent `site.example.test` and a `.onion` name as `ATYP 3`.
- Proxy addresses: only `socks5://`, `http://` and `https://` (`src/main/browser/proxy.ts`). `socks4://` and `socks4a://` are refused on save, and a saved one reads back as no proxy, since SOCKS4 resolves names locally.
- `.onion` outside Tor: direct and private tabs refuse a typed `.onion` address with a message to use a Tor tab, and the shield blocks links and redirects to one (reason `onion`) before any lookup. In Privacy Mode every tab is routed, so this does not apply.
- `<link rel=dns-prefetch>` hints skip the shield, and Chromium sent real DNS queries for a `.onion` name in one. Outside Privacy Mode the app and the background browser now start with the host-resolver rule `MAP *.onion ~NOTFOUND, MAP *.onion. ~NOTFOUND` (`src/main/shield/onion.ts`), kept in front of any rule given on the command line. Checked 2026-11-27 with Chromium's net log: before, a dns-prefetch hint and an image for `.onion` names sent DNS queries; after, none, in a direct tab of the built app and in headless Chrome, while a control name was still prefetched and a proxy tab still sent `.onion` to a SOCKS5 server as a name.
- WebRTC: `disable_non_proxied_udp` on routed tabs, `default_public_interface_only` on the others and in background browsing (`src/main/shield/webrtc.ts`).
- Non-direct tabs: no browsing history, no saved-password suggestions, fill or save offers, not restored after restart.
- Downloads are off in Tor tabs.
- Tor tabs wait up to 60 s for a page instead of 15 s.

## Shield (`session.webRequest.onBeforeRequest` on every pane session)

1. **Local network (13.5).** A local target is `localhost`, `*.localhost`, `*.local`, or a literal private IP (`src/main/private.ts`). Routed tabs: always blocked. Other tabs: blocked when a public page started the request, except a top-level `GET` navigation. Typed addresses and agent navigations to `localhost` keep working. Since 2026-11-27, direct and private tabs also resolve each name through the session's resolver (`src/main/shield/rebound.ts`): a request to a name that resolves to a private address is blocked when it comes from a page loaded from a public address, except a top-level `GET`. Routed tabs skip the lookup, so the name is never revealed. Ceiling: an answer that changes between the lookup and the connection passes.
2. **Secret guard (13.3).** The URL and the request body are matched against stored keys and tokens: model, database and search-engine API keys and connector tokens, 16 characters or more. Also applied to `fetch_web_page`, `search_web` queries and background browsing.
3. **Downloads (13.11).** A download is paused into the Downloads folder and the tab shows a bar: Download or Cancel. Agent-started downloads wait for the user too.
4. **Tracking parameters (13.6).** A top-level `GET` page load whose query carries `utm_*` or a click id (`…clid`, `…clkid`, any case) is redirected to the same address without them (`src/main/shield/strip.ts`). Other parameters keep their exact bytes; the fragment is untouched. Not applied to `fetch_web_page`.
5. **Trackers (13.1).** A third-party request to a host on the bundled EasyPrivacy list (`resources/shield/easyprivacy.txt`) is blocked, reason `tracker` (`src/main/shield/list.ts`, `tracker.ts`, last check in `verdict`). Only `||host^` rules are used, with `$third-party` and type options honoured; `@@||host^` exceptions apply; rules with `domain=` or other options are skipped. Third-party means the request's registrable domain (public suffix list) differs from the tab's committed address; a request with no tab address counts as third-party. Main-frame loads are never blocked. Same on every route. On by default, no setting. Not applied to `fetch_web_page` or `search_web`.

Blocked requests are listed per tab (last 50, cleared on each new page) and counted on a toolbar button. Tracker requests are counted one by one and listed once per tracker site; the list starts with "N tracker requests blocked on this page".

## Background browsing (headless Chrome in background runs)

Since 2026-11-27 it asks the same rules as the pane (`src/main/agent/tools/web/use_web_browser.ts`):

- Every request (`context.route`) and every WebSocket a page or frame opens (`context.routeWebSocket`) goes through `verdict` (`src/main/shield/verdict.ts`), then the existing `publicUrl` check, which blocks every private target, also after a name lookup. A check that throws blocks.
- A top-level `GET` page load with tracking parameters is answered with a 307 to the stripped address (`strip.ts`).
- WebRTC: `default_public_interface_only`, the policy of direct pane tabs, from `src/main/shield/webrtc.ts` (shared with the pane). Chrome 158 ignores `--force-webrtc-ip-handling-policy`; it honours `--webrtc-ip-handling-policy`, which is what the launch passes.
- Checked 2026-11-27 in the built app: a scheduled task with a mock model opened a page on a fake public name (served from this machine), which opened WebSockets to `127.0.0.1` and to the LAN IP, a `fetch` to `127.0.0.1`, and an `RTCPeerConnection`. The two sockets and the fetch never reached the server; a control socket to a public name did. With mDNS hiding turned off, no ICE candidate was gathered; with the WebRTC switch removed, a host candidate carried the LAN IP. `?utm_source=x&keep=1&gclid=abc#frag` arrived as `?keep=1` and the page ended on `?keep=1#frag`.
- Ceiling: a WebSocket opened inside a worker is not checked (Playwright routes only page and frame sockets). In the same check one reached `127.0.0.1`. Chrome's own local-network check blocked it when the page was marked public with `--ip-address-space-overrides`, but the secret guard does not see it. A `fetch` from a worker was blocked. A headless Chrome probe the same day showed that a socket opened through an `about:blank` iframe's `WebSocket` and a service worker's `fetch` are checked.
- Ceiling: `publicUrl` resolves the name with the system resolver and Chrome resolves it again, so an answer that changes between the two lookups passes.
- If the request or WebSocket check cannot be installed, the browser is not used.

## User surface

- Pane: a "New private, Tor or proxy tab" button next to "New tab"; a route badge in the toolbar; route icons in the tab strip; the shield button when something was blocked; the download bar. Route labels, hints, that menu and the blocked reasons are translated (en, it); the Tor and proxy hints say the assistant's web search and page fetch use the normal network.
- Settings → Browser → Connections: Tor address (empty = automatic) with a Check button, proxy address (`socks5://host:port`, `http://host:port`), and what the routes do not cover: only the pane is routed, page text still goes to the model provider, and this is not Tor Browser.
- Agent: `use_web_browser` `open` takes `route`. Opening a Tor tab always asks the user.

## Verify

1. Private tab: a cookie set there is absent from a direct tab and from a second private tab; nothing in history; not restored.
2. Tor tab against a fake SOCKS5 server: the request arrives as a domain name (`ATYP 3`), including `.onion`; with the server stopped the tab fails and nothing loads directly.
3. Proxy tab: requests reach the configured proxy; a stopped proxy fails the tab.
4. Shield: a public page's `fetch('http://127.0.0.1:…')` is blocked and listed; typing `localhost` loads; a URL holding a saved key is blocked; `?utm_source=x&keep=1#frag` commits as `?keep=1#frag`.
5. Download: the bar appears; Cancel leaves no file; Download saves it.
