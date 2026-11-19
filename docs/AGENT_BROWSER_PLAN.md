# Embedded agent browser plan

Status: proposed. This document describes future work, not current behavior.

## Goal

Show the interactive agent's browser on the right side of the main Kucedr window, so the user can watch the agent work while continuing the conversation. The browser should not open a separate Chrome window.

## Current behavior

The `use_web_browser` tool launches a persistent Chrome context through Playwright for interactive runs. Background runs use a separate headless browser with a temporary profile. The `search_web` tool queries the configured search engine separately and does not itself need a browser window. Kucedr already uses `WebContentsView` for app windows, but that view is not the agent browser.

Relevant starting points:

- `src/main/agent/tools/web/use_web_browser.ts` and `src/main/agent/tools/web/browser/session.ts`: browser actions and interactive session.
- `src/main/agent/tools/web/browser/background.ts`: background browser lifecycle.
- `src/main/apps/app_render.ts`: existing Electron view layout example.

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

The browser tool controls Chrome through Playwright, and a view embedded in the Kucedr window is not something Playwright can attach to safely. Three ways to resolve it:

| Approach | How it works | For | Against |
| --- | --- | --- | --- |
| **Mirrored view (recommended first)** | Chrome keeps running under Playwright with no window; the pane shows its live picture and forwards the user's clicks and typing | Tool behaviour, tabs, saved logins and background runs stay exactly as they are; smallest change; PDF export starts working in interactive runs | The pane is a picture of a page: no text selection, password autofill or screen-reader access inside it; some sites may treat windowless Chrome differently (to check in the prototype) |
| Native view, driven in-process | A real Electron web view in the pane; the tool's actions are rewritten on Electron's own debugging interface | A true browser the user can use directly | Rewrites every action (click, type, snapshot, tabs) and loses Playwright's waiting logic; two browser back ends to maintain |
| Native view, driven by Playwright | A real web view; Playwright attaches through a local debugging port | Keeps Playwright | Ruled out: the port exposes every Kucedr window, including the one that can read API keys, to any program on the machine |

Recommendation: prototype the mirrored view first. Build the pane (toolbar, tabs, resize, close and reopen) so that it does not care which approach feeds it, and move to the in-process native view only if direct use of the page (logins, captchas) proves too rough.

Sign-in fallback for the mirrored view: an "open in a window" action that reopens the same profile as a normal Chrome window for the user to log in, then returns to the pane.

The pane later carries a per-tab route (direct, private, VPN, Tor); see sections 11 and 12 of the [Roadmap](ROADMAP.md).

## Implementation steps

1. **Validate the automation approach.** Prototype an Electron `WebContentsView` in the main window and determine how the existing Playwright-based actions can control it. Electron's web contents and Playwright's `Page` have different APIs; verify navigation, accessibility snapshots, screenshots, interaction, and tab handling before choosing an implementation. Do not assume a direct drop-in replacement.
2. **Add the pane and view lifecycle.** Integrate a right-hand pane with the main window layout. Position and resize the native view to match the pane, including when the window changes size, the pane is hidden, or the application closes.
3. **Adapt interactive browser operations.** Connect `use_web_browser` to the embedded browser while preserving its action contract, tool results, permissions, cancellation, and error handling. Map agent tabs to embedded pages and display the active tab. Keep background runs on their existing backend.
4. **Connect controls and session state.** Synchronize navigation, address, active tab, loading, and errors between the Electron main process and renderer. Define ownership and cleanup for tabs, window closure, cancellation, and concurrent runs.
5. **Isolate remote content.** Keep external pages separate from Kucedr's privileged renderer and preload APIs. Handle navigation, pop-ups, downloads, and browser session persistence explicitly, preserving existing permission boundaries.

## Verification

- Test the browser action contract, tab mapping, session lifecycle, permission checks, and cancellation.
- In the running Electron app, ask the agent to search, open a result, click, type, take a screenshot, and switch tabs. Confirm the page appears on the right and no separate Chrome window opens.
- Check resizing, narrow windows, keyboard focus, loading and error states, pane close and reopen, and window shutdown.
- Confirm background runs still use their headless browser and direct web search still works.

## Open decisions

- Choose the automation integration after the feasibility prototype; account for actions that Electron does not expose directly.
- Decide how browser tabs and the reopen control appear within the existing interface.
- Determine whether existing interactive Chrome profile data can be retained or whether the embedded browser needs a new session; document the user-visible effect before changing persistence.
