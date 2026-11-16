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
