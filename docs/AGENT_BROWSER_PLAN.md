# Embedded agent browser plan

Status: built for interactive runs, with one `WebContentsView` per tab as chosen under "Automation approach". "As built" below describes current behavior; the rest is the plan it came from.

## As built

Each tab the agent opens is its own sandboxed web view with no Kucedr preload, in the session `persist:agent-browser`. The pane sits on the right of the main window, beside the navigation bar; the active tab's view is placed exactly over the pane's page area. Under 1000 px of window width the pane covers the chat below the navigation bar. Background runs still use headless Chrome through Playwright.

- Main process: `src/main/agent/tools/web/browser/` (`create`, `close`, `run`, `act`, `locate`, `press`, `settle`, `snapshot`, `tabs`, `command`, `observe`, `pane`) and `src/main/ipc/browser.ts`. `use_web_browser.ts` hands interactive calls to `run` and keeps the Playwright code for background runs.
- Window: `src/renderer/src/pages/home/browser/` (`Pane`, `Toolbar`, `Tabs`, `Screen`, `state`), mounted in `src/renderer/src/pages/home/Page.tsx`.
- Contract: `src/shared/browser.ts`, exposed to the window as `window.browserPane`.

How it works, and what is easy to break:

- The agent drives a view through its in-process debugger with focus emulation on. That works whether the view is shown, hidden or not yet in a window, and the chat keeps keyboard focus. `sendInputEvent` and `capturePage` do not work on a view that was never added to a window.
- `Screen` reports the pane's rectangle every frame and the main process sizes the view. The rectangle is multiplied by the app zoom in the preload.
- The view is drawn above the app. `Screen` hides it whenever something else is on top of the pane (dialog, menu, command menu), and shows the app's own message when a page fails to load. The toolbar uses native `title` tips because app tooltips would sit behind the view.
- Pop-ups open as tabs of the same chat. Site permission requests are denied, downloads are cancelled, and navigation to anything but http and https is blocked.
- The user agent has the `Electron/…` and app tokens removed.
- The tab strip is always shown, Chrome style: favicon, title and a close button per tab, and a new-tab button. This goes beyond "Behaviour in detail" below, which asked for a strip only with more than one tab. Favicons are fetched through the browser's own session.
- The agent has a pointer of its own (`cursor.ts`, roadmap 3.11): it glides to each click, hover and drag target, a ripple marks a click, and the field being typed into is outlined. It is drawn in a closed shadow root from a separate script world, takes no clicks, fades after three seconds, is removed before a screenshot, and respects reduce-motion. A frame around the page replaces the toolbar dot while the agent acts. Not built: a setting to turn it off.
- The page outline leaves out the value of password fields, so a password typed in the pane is not sent to the model.

Not built:

- Background runs on views; they still need Google Chrome.
- A still image in place of the hidden view while an overlay is open; the pane is blank until it closes.
- Holding downloads to offer them; they are cancelled.
- Elements inside frames: snapshot and clicks see the top document only, as before.
- On Windows and Linux the window buttons stay in the navigation bar, to the left of the pane.
- Removing the old Chrome profile folder (`~/.kucedr/agent-browser`); saved logins there are not carried over.
- Importing passwords and sign-ins from other browsers. Bookmarks, history and the search engine are imported; see [Browser import](roadmap/BROWSER.md).
- Unit tests for the view backend. The existing browser tests cover background runs only.

## Goal

Show the interactive agent's browser on the right side of the main Kucedr window, so the user can watch the agent work while continuing the conversation. The browser should not open a separate Chrome window.

## Current behavior

The `use_web_browser` tool launches a persistent Chrome context through Playwright for interactive runs. It uses the Google Chrome installed on the machine and fails without it. Background runs use a separate headless browser with a temporary profile. The `search_web` tool queries the configured search engine separately and does not itself need a browser window. Kucedr already uses `WebContentsView` for app windows, but that view is not the agent browser.

Relevant starting points:

- `src/main/agent/tools/web/use_web_browser.ts` and `src/main/agent/tools/web/browser/session.ts`: browser actions and interactive session.
- `src/main/agent/tools/web/browser/background.ts`: background browser lifecycle.
- `src/main/window_factory.ts` (`createView`) and `src/main/apps/app_render.ts`: how a separate view is created, added to a window and sized today.

## Proposed behavior

- Open a resizable browser pane to the right of the conversation when an interactive agent starts browsing.
- Show a compact toolbar with the current address, back, forward, reload, and close controls, using existing Kucedr components and styling.
- Keep the chat usable while the browser is open. Handle small windows and resizing without obscuring either pane.
- Show loading and error states, and keep the toolbar synchronized with the active page.
- Closing the pane hides it without automatically stopping the browser session or the agent. Define a visible way to reopen it during implementation.
- Preserve the existing headless background browser and direct search behavior.

### Behaviour in detail

The agent's browser tool owns the browser. The user does not open it from a menu.

- **Opening.** The first browser action in a chat (`start`, `open` or `navigate`) opens the pane on the right of that chat and loads the page. No Chrome window appears.
- **Closing.** The tool's `stop` action closes the pane. The user's close button only hides it; the browser and the agent keep running, and a button in the chat header brings it back while a browser session is alive.
- **Tabs.** Tabs the tool opens, focuses and closes are the tabs shown. The tab strip appears only when there is more than one.
- **Which chat.** The pane shows the tabs opened by the chat on screen and hides when the user switches to a chat that has none.
- **Toolbar, minimal.** Back, forward, reload (stop while loading), the address, close. A thin loading bar and a small indicator while the agent is acting on the page. Nothing else: no bookmarks, history, downloads list, extensions or developer tools.
- **User input.** The address can be edited and the page can be clicked and typed in, so the user can help with a login or a captcha. The agent sees the result on its next snapshot. Nothing locks the page while the agent works; the indicator is the only signal.
- **Layout.** The divider between chat and pane can be dragged; under a minimum window width the pane covers the chat with a way back. Home has no right-hand panel today; `react-resizable-panels` is already installed and used in `src/renderer/src/pages/code/Page.tsx`.

## Automation approach

Direction chosen on 2026-11-19: **each browser tab is its own `WebContentsView`**, placed over the pane's area of the main window and driven from the main process. The page is not drawn inside Kucedr's own page. This replaces the earlier recommendation of a mirrored view.

### Why a separate view

- **The app already works this way for app windows.** `createView` in `src/main/window_factory.ts` builds a sandboxed view with its own session, and `src/main/apps/app_render.ts` adds it to the window and sizes it.
- **It is a real page.** Text selection, typing, input methods and screen readers work inside it.
- **No Google Chrome needed.** Today the tool cannot browse on a machine without Chrome.
- **The tool's page reading carries over unchanged.** `snapshot` is a plain script run in the page that tags elements with `data-agent-ref`; nothing depends on Playwright's own page reading.
- **Each view has its own network session.** That gives the roadmap direct hooks: request filtering for the [Network shield](roadmap/SHIELD.md), a proxy per session for [VPN](roadmap/VPN.md) and [Tor](roadmap/TOR.md) tabs, memory-only sessions for private tabs, download and permission handling, and separate sessions per workspace.

### What each tool action becomes

| Tool action | Today, through Playwright | With the view |
| --- | --- | --- |
| `open`, `navigate`, back, forward | Page navigation calls | The view loads the address; its own history moves back and forward |
| `tabs`, `focus`, `close` | Pages in one browser context | One view per tab; only the active one is attached and visible |
| `snapshot`, `act evaluate` | Script run in the page | The same script run in the view |
| `act click`, `hover`, `drag` | Locator actions with built-in waiting | Find the element's position by script, then send real mouse events; Kucedr's own "wait until visible and still" step |
| `act type`, `fill`, `press`, `select` | Locator actions | Focus by script, insert text, send key events; set a select by script |
| `act wait` | Wait for a selector or load state | Poll by script; load events from the view; "network idle" needs its own definition |
| `screenshot` | Page, full page or one element | Capture the view; full page and single element through the view's own in-process debugging interface |
| `pdf` | Background runs only | Print to PDF, available in interactive runs too |
| `console` | Page console events | The view's console events |

### Costs and limits

- **The view is drawn above Kucedr's own page.** A menu, dialog, command menu or tooltip that overlaps the pane would be hidden behind it. The toolbar sits outside the view, and when an app overlay opens over the pane the view is hidden, or swapped for a still image, until it closes.
- **The pane's position comes from the renderer.** The divider is dragged in the page, so the renderer reports the pane's rectangle to the main process, which sizes the view. App views are sized from the window alone today.
- **About a dozen actions are rewritten**, with Kucedr's own waiting logic. Clicks may be less reliable than Playwright's at first; a fixed set of test pages is needed.
- **It is not Google Chrome.** Some sites refuse sign-in inside embedded browsers (Google's sign-in is known for this), protected video does not play, and there are no extensions or password manager. To check in the prototype. For Google and Microsoft data, connectors are the intended path, not signing in through the pane.
- **Browser fixes arrive with app updates.** The pane's engine is the one Electron ships, so Electron has to be kept current.
- **Saved logins do not carry over** from the current Chrome profile (`~/.kucedr/agent-browser`); users sign in again once.
- **Two back ends for a while.** Background runs keep the headless Playwright browser in the first version.

### Rules for the view

- Sandboxed, isolated, no Node access, and none of Kucedr's preload APIs. App views share the main preload today; the browser view must not.
- Its own session, separate from the app's and from app windows'. Kucedr's internal address schemes are not available in it.
- A page that opens a new window gets a new tab in the pane, never a window.
- Site permission requests are denied by default and downloads are held, as in the [Network shield](roadmap/SHIELD.md).
- The view is never registered as a trusted window, so it cannot call Kucedr's internal channels.

### Approaches not chosen

| Approach | Why not |
| --- | --- |
| Mirrored view: Chrome runs under Playwright with no window and the pane shows its live picture | Smallest change to the tool, but the pane is a picture of a page (no selection, no screen-reader access), Chrome is still required, and the shield, VPN and Tor would each need separate work inside Chrome |
| Playwright attached to the view through a local debugging port | The port exposes every Kucedr window, including the one that can read API keys, to any program on the machine |

The pane later carries a per-tab route (direct, private, VPN, Tor); see [Tor and .onion sites](roadmap/TOR.md) and [Private and VPN browsing](roadmap/VPN.md) in the roadmap.

## Implementation steps

1. **Prototype the separate view.** Add one `WebContentsView` to the main window. Run the snapshot script in it, click and type through input events, and take a screenshot. Check sign-in on a few major sites, and what happens when an app menu opens over the view. Confirm or revise the direction above before building further.
2. **Add the pane and view lifecycle.** Integrate a right-hand pane with the main window layout. Position and resize the native view to match the pane, including when the window changes size, the pane is hidden, an overlay opens, or the application closes.
3. **Move interactive browser operations to the view.** Connect `use_web_browser` to the embedded browser while preserving its action contract, tool results, permissions, cancellation, and error handling. Map agent tabs to views and display the active tab. Keep background runs on their existing backend.
4. **Connect controls and session state.** Synchronize navigation, address, active tab, loading, and errors between the Electron main process and renderer. Define ownership and cleanup for tabs, window closure, cancellation, and concurrent runs.
5. **Isolate remote content.** Apply the rules for the view above. Handle navigation, pop-ups, downloads, and browser session persistence explicitly, preserving existing permission boundaries.

## Verification

- Test the browser action contract, tab mapping, session lifecycle, permission checks, and cancellation.
- In the running Electron app, ask the agent to search, open a result, click, type, take a screenshot, and switch tabs. Confirm the page appears on the right and no separate Chrome window opens.
- Repeat on a machine without Google Chrome installed.
- Open the command menu, a dialog and a dropdown while the pane is showing; confirm none is hidden behind the page.
- Check resizing, narrow windows, keyboard focus, loading and error states, pane close and reopen, and window shutdown.
- Confirm background runs still use their headless browser and direct web search still works.

## Open decisions

- **Background runs.** Recommended: keep the headless Playwright browser in the first version, then move background runs to hidden views so Playwright and the Chrome requirement can be removed.
- **Overlays.** Hide the view or show a still image while an app overlay covers the pane.
- **Tabs and reopen control.** How they appear within the existing interface.
- **Existing Chrome profile.** Recommended: start a new session, say so in the release notes, and offer to delete the old folder.
- **Sites that refuse embedded browsers.** What the pane tells the user when a sign-in is refused.
