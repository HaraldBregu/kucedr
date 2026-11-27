# Browser Routes and Shield — Plan

> **Status:** plan and build, 2026-11-24. Roadmap: [Tor](roadmap/TOR.md) 11.1–11.3, [Private and VPN browsing](roadmap/VPN.md) 12.1, 12.2, 12.4 (without the workspace default), [Network shield](roadmap/SHIELD.md) 13.3, 13.5, 13.6 (WebRTC and tracking parameters), 13.11.

## Scope

Each browser pane tab has a **route**: `direct` (today's tabs), `private`, `tor` or `proxy`. The route is fixed when the tab opens. One request check (the shield) runs on every pane session.

Not in this pass: tracker blocking (13.1, waits for the block-list decision), untrusted content marking (13.10), the network view (13.8, waits for the Privacy centre), built-in Tor (11.4), WireGuard profiles (12.3), proxies that need a username and password (Chromium's SOCKS client has no password support; HTTP proxy sign-in comes later), and routes in background runs.

## Routes

| Route | Session | Connection | Saved |
| --- | --- | --- | --- |
| `direct` | `persist:agent-browser`, shared by all direct tabs | Direct | Logins, history, restored after restart |
| `private` | Its own in-memory session per tab (popups share it) | Direct | Nothing. Wiped when its last tab closes |
| `tor` | Same as private | `socks5://` to Tor, no fallback, loopback not bypassed | Nothing |
| `proxy` | Same as private | The proxy from Settings, no fallback | Nothing |

- Tor comes from the machine: the address in Settings, else the first of `127.0.0.1:9150` (Tor Browser) and `127.0.0.1:9050` (Tor service) that answers a SOCKS5 greeting.
- A routed session blocks every request until its proxy is applied, and stays blocked if Tor or the proxy cannot be set. Chromium with `fixed_servers` does not fall back to direct.
- `socks5://` sends host names to the proxy, so names (including `.onion`) are not looked up on the user's connection. **To verify** with a fake SOCKS5 server.
- WebRTC: `disable_non_proxied_udp` on routed tabs, `default_public_interface_only` on the others.
- Non-direct tabs: no browsing history, no saved-password suggestions, fill or save offers, not restored after restart.
- Downloads are off in Tor tabs.
- Tor tabs wait up to 60 s for a page instead of 15 s.

## Shield (`session.webRequest.onBeforeRequest` on every pane session)

1. **Local network (13.5).** A local target is `localhost`, `*.localhost`, `*.local`, or a literal private IP (`src/main/private.ts`). Routed tabs: always blocked. Other tabs: blocked when a public page started the request, except a top-level `GET` navigation. Typed addresses and agent navigations to `localhost` keep working. Since 2026-11-27, direct and private tabs also resolve each name through the session's resolver (`src/main/shield/rebound.ts`): a request to a name that resolves to a private address is blocked when it comes from a page loaded from a public address, except a top-level `GET`. Routed tabs skip the lookup, so the name is never revealed. Ceiling: an answer that changes between the lookup and the connection passes.
2. **Secret guard (13.3).** The URL and the request body are matched against stored keys and tokens: model, database and search-engine API keys and connector tokens, 16 characters or more. Also applied to `fetch_web_page`, `search_web` queries and background browsing.
3. **Downloads (13.11).** A download is paused into the Downloads folder and the tab shows a bar: Download or Cancel. Agent-started downloads wait for the user too.
4. **Tracking parameters (13.6).** A top-level `GET` page load whose query carries `utm_*` or a click id (`…clid`, `…clkid`, any case) is redirected to the same address without them (`src/main/shield/strip.ts`). Other parameters keep their exact bytes; the fragment is untouched. Not applied to background browsing or `fetch_web_page`.

Blocked requests are listed per tab (last 50, cleared on each new page) and counted on a toolbar button.

## User surface

- Pane: a "New private, Tor or proxy tab" button next to "New tab"; a route badge in the toolbar; route icons in the tab strip; the shield button when something was blocked; the download bar.
- Settings → Browser → Connections: Tor address (empty = automatic) with a Check button, proxy address (`socks5://host:port`, `http://host:port`), and what the routes do not cover: only the pane is routed, page text still goes to the model provider, and this is not Tor Browser.
- Agent: `use_web_browser` `open` takes `route`. Opening a Tor tab always asks the user.

## Verify

1. Private tab: a cookie set there is absent from a direct tab and from a second private tab; nothing in history; not restored.
2. Tor tab against a fake SOCKS5 server: the request arrives as a domain name (`ATYP 3`), including `.onion`; with the server stopped the tab fails and nothing loads directly.
3. Proxy tab: requests reach the configured proxy; a stopped proxy fails the tab.
4. Shield: a public page's `fetch('http://127.0.0.1:…')` is blocked and listed; typing `localhost` loads; a URL holding a saved key is blocked; `?utm_source=x&keep=1#frag` commits as `?keep=1#frag`.
5. Download: the bar appears; Cancel leaves no file; Download saves it.
