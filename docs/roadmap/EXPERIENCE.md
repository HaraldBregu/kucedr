# 3. User experience

Part of the [Roadmap](README.md). Status: proposal; 3.1–3.4, 3.6–3.9, 3.11 and 3.12 are built (see each row).

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 3.1 | Completion notifications | A system notification and dock badge when a background run, task or approval needs attention | Built 2026-11-21–22 (`src/main/notifications`): finished, failed and waiting chats, finished or failed tasks, health checks that need attention; a badge count; clicking opens the chat; a switch in Settings → General. Not checked in the running app | S |
| 3.2 | Search across chats | Find any message in any chat from one search box | Built 2026-11-25: the sidebar search (`session_search_sessions.ts`, `pages/home/Finder.tsx`) searches user and assistant text, not tool output, labels archived chats, and returns the message position from the same history conversion the chat view uses (`session_to_history_messages.ts`); choosing a result opens the chat, scrolls to that message and highlights the match (`pages/home/Search.tsx`). Checked in the built app with seeded chats, including a reply merged from two saved messages. No index yet | M |
| 3.3 | Regenerate and retry | Re-run a reply, or retry a failed one, from the message | Built 2026-11-21: Regenerate in the message actions with a confirmation, Retry on a failed reply (`AssistantMessage.tsx`, `useHomeAgent.ts`). Not checked in the running app; messages with attachments not verified | S |
| 3.4 | Complete the "/" menu | Skills and task commands appear in the menu that already opens on `/` | Built 2026-11-25 (`components/prompt-slash.tsx`): a Skills group (a check on skills on in the chat; choosing one fills `/skill <id>` or `/skill off <id>`) and a Tasks group with the three task commands, each with a one-line description. Checked in the built app: the menu lists them, a chosen skill is loaded into the run and shows as active, and turning it off removes it | S |
| 3.5 | Shortcut guide | One screen listing every shortcut, fed by a single list | Shortcuts are defined in four places; three of them do nothing today | M |
| 3.6 | Offline and failure states | A clear message and a retry when offline, when a chat fails to load, or when a rename fails | Built 2026-11-25. Offline: Home follows the browser's `online` and `offline` events and shows "You're offline. Local models still work; cloud models, web search and connected services need a connection." above the composer until the connection returns (`pages/home/Page.tsx`). A chat that fails to load shows "Could not load this chat" with Try again instead of an empty chat (`historyError` and `retryHistory` in `useHomeAgent.ts`); a new chat, which has nothing to load yet, never shows it. A failed rename shows "Could not rename the chat. Try again." in the sidebar (English and Italian). The chat list already had its own error and Retry. Checked in a production build with the network switched off through DevTools and with the snapshot and rename requests made to fail. `online` only reports whether the machine has a network at all, not whether the internet is reachable. The offline and load messages are in English, like the rest of Home | S |
| 3.7 | Undo and archive view | Undo after delete or archive; a place to see archived chats | Built 2026-11-25 (`pages/home/Sidebar.tsx`): deleting or archiving chats from the Home sidebar shows "Chat deleted / archived · Undo" for 6 seconds. Delete no longer asks; it is delayed and runs when the notice ends, on reload or on leaving Home; Undo on archive unarchives. Archived chats are listed in Settings › Chat history. Checked in the built app in English and Italian. Quitting the app during the 6 seconds keeps the chat | S |
| 3.8 | Attachment checks | A warning before sending a file the model cannot read or that is too large | Built 2026-11-25: types and manifest size limits were already checked against the selected model's capabilities; added a 5 MB limit for files the manifest gives no size for, including text files (`pages/home/attachments/large.ts`), when adding and before sending. Checked in the built app with two manifest models: wrong type and over-limit files are refused with a message (English and Italian), and a 6 MB PDF within the manifest's 50 MB limit is accepted | S |
| 3.9 | Browser pane | When the agent uses the browser tool, the page appears in a resizable pane on the right of the chat instead of a separate Chrome window | Built for interactive runs: each tab is its own web view placed over the pane; see "As built" in the [Embedded agent browser plan](../AGENT_BROWSER_PLAN.md) and [Status](BROWSER.md#status) in Browser import | L |
| 3.10 | Chat export, import and sharing | Export a chat as Markdown, HTML or PDF; import chats from other assistants; later, share a chat by link | Export exists for workspace documents only (`src/main/export.ts`); a share link needs a server and is a later decision | S–M |
| 3.11 | Agent cursor in the browser pane | A pointer glides to where the agent is about to click, marks the click, and shows what it is typing into, so the user can follow what the agent does on the page | Built; see "As built" in the [browser plan](../AGENT_BROWSER_PLAN.md). The switch to turn it off was added 2026-11-25 in Settings › Browser (`agentCursor`, on by default); with it off the pointer and the glide before each click are skipped. Checked in the built app with a mock model | S–M |
| 3.12 | Browser control from the chat | "Click Sign in on this page" acts on the tab on screen; follow-up messages continue in the same tab; the agent never closes the user's tabs; scroll, reload, and Stop in the pane; see [Browser control plan](../BROWSER_CONTROL.md) | Built 2026-11-23: the tab on screen is used first, tabs list `shown` and `mine`, the agent closes only tabs it opened in that chat, `scroll`, `reload`, and Stop in the pane toolbar; checked in the built app, including after a restart. Not checked: task runs, two chats acting at once, two windows; see [Status](../BROWSER_CONTROL.md#status) | M |
| 3.13 | Confirmations in the app's style | Delete and remove prompts look like the rest of Kucedr, follow the theme and are translated, instead of a plain system box | Built 2026-11-26; all renderer confirmations now use the shared themed dialog | S |
| 3.14 | Consistent empty and loading states | Every list says what belongs there and how to add the first item; every page shows the same loading rows | Built 2026-11-26 for the identified Settings lists; shared placeholders now cover plugin discovery, permissions, browser profiles, knowledge search and embedding models, cloud folders, MCP tools and account activity | S |
| 3.15 | A visual consistency pass | Colours, text sizes and spacing come from the theme everywhere, so light, dark and plugin themes look right on every page | 41 fixed palette colours in 11 files and 59 fixed pixel sizes in the renderer | S–M |
| 3.16 | A useful empty chat | A new chat offers a few starting points instead of a greeting only | Built 2026-11-26: localized greeting, three prompt starters and a recent-chat continuation suggestion when available | S |
| 3.17 | Smoother first-run setup | Connect a model first, skip what can wait, and land in a chat that works | Built 2026-11-26: model → chat → optional plugins and voice, with Skip for now | S–M |
| 3.18 | Find any setting | Typing a setting's name (for example "sound" or "dark") finds the switch, not only the page | The command menu lists Settings pages from `SETTINGS_NAVIGATION`; individual options are not searchable | S |

The terminal panel has its own area: [Terminal](TERMINAL.md).

The browser pane later carries [Tor tabs](TOR.md) and [private and VPN tabs](VPN.md), and can
[import from other browsers](BROWSER.md).

## User experience in detail

Suggested order for what is left: 3.5, then the interface polish items below. 3.1–3.4, 3.6–3.9,
3.11 and 3.12 are built.

The interface polish items added 2026-11-25 (3.13–3.18) are small and independent. Suggested
order: 3.14 next (quick, visible everywhere), then 3.17 and 3.16 (what a new user meets
first), then 3.15 and 3.18. 3.13 should be decided together with undo (3.7).

### 3.1 Completion notifications

Built as planned below, with its own switch in Settings → General rather than beside the sound
switch. A click does nothing when every window is closed.

- _Behaviour._ A system notification when a run finishes or fails while the window is unfocused or
  another chat is on screen; when a run is waiting for an approval or an answer; when a scheduled
  task or health check finishes or needs attention. Clicking it opens that chat. A dock or taskbar
  badge counts chats needing attention and clears when they are viewed.
- _Setting._ One switch beside the existing sound switch in Settings → General
  (`soundFeedbackEnabled` in `src/main/settings_store.ts`). The system's do-not-disturb is
  respected automatically.
- _Builds on._ Run events already defined in `src/shared/agent_types.ts` (`run_finished` with its
  stop reason, `tool_permission_request`, `user_input_request`).
- _Needed first._ The main process has no run lifecycle signal: events go only to the window that
  started the run (`src/main/ipc/agent.ts`), background runs send nothing, and main does not know
  which chat is on screen. One change fixes all three: main announces start, waiting and finish for
  every run, and the window reports its visible chat. The same signal lets the sidebar stop polling
  (2.6) and shows approvals waiting in other chats.
- _Open decision._ Recommended: the notification shows the chat title only, never message text,
  because notifications appear on the lock screen.
- _Check._ A run ending with the window unfocused raises exactly one notification; clicking opens
  the chat; none appears when that chat is on screen and focused.

### 3.2 Search across chats

- _Behaviour._ A search field above the chat list. Results are grouped by chat with a line of
  surrounding text. Choosing one opens the chat, scrolls to the message and highlights the match.
  Archived chats are included and labelled.
- _Builds on._ The in-chat highlight in `src/renderer/src/pages/home/Search.tsx`; the message
  loader in `src/main/agent/session`.
- _Approach._ The first version reads the chats directly, off the main thread, with no index. At
  the surveyed size (131 chats, 43 MB) that is enough. An index, using the built-in SQLite the
  knowledge store already uses, comes when a search takes longer than about a third of a second.
- _Complications._ Saved messages have no ids; the chat view numbers them by position after
  filtering, so search has to return the same position. The strings in `Search.tsx` are hard-coded
  English. If data is encrypted at rest (1.3), search runs after decryption, which a direct read
  handles and an index would not without more work.
- _Open decision._ Recommended: search what the user and the assistant wrote, not tool output.
- _Check._ A word known to be in an old chat is found, and opening the result lands on that message.

### 3.3 Regenerate and retry

Built as planned below; the complications are still unverified.

- _Behaviour._ A Regenerate action beside Copy, Read aloud and Reply on assistant messages
  (`src/renderer/src/pages/home/components/AssistantMessage.tsx`), and a Retry button on a failed
  reply. The new reply replaces the old one. Regenerating an older reply discards what came after
  it, with the same warning editing gives.
- _Builds on._ Editing a message already cuts history and re-runs (`Agent.editUserMessage` in
  `src/main/agent/agent.ts`). Regenerate is that with the text unchanged.
- _Complications._ That path handles plain-text messages only, so messages with attachments need it
  extended. Whether a failed reply survives a restart is not verified.
- _Open decisions._ Recommended: replace only, with no branches or version switcher. Files the
  discarded reply changed are not rolled back; the message should say so.
- _Check._ Regenerate on the last reply produces a new one and the history on disk holds a single
  reply; Retry after a forced provider error succeeds.

### 3.4 Complete the "/" menu

- _Behaviour._ Skills (turn on, turn off) and the task commands appear in the existing menu with a
  one-line description each.
- _Builds on._ `PromptSlash` in `src/renderer/src/components/prompt-slash.tsx`, the skills list
  exposed by `src/preload/skills.ts`, and the task commands in
  `src/renderer/src/pages/home/hooks/commands.ts`.
- _Check._ Typing `/` lists every command the composer accepts; choosing a skill enables it for the
  chat.

### 3.5 Shortcut guide

Built 2026-11-26. Settings › Keyboard shortcuts lists app, chat, workspace editor and browser tab
shortcuts from `SHORTCUTS` in `src/shared/app_types.ts`; Help and the command menu open the page.
That registry also supplies app shortcut dispatch, native menu accelerators (including both zoom-in
keys), browser tab bindings and workspace toolbar labels. The previously intercepted no-op
shortcuts were removed; ⌘D/Ctrl+D now opens chat history. Rebinding is not included. No dedicated
automated accessibility check was added for this page.

### 3.11 Agent cursor in the browser pane

- _Behaviour._ While the agent acts on a page, a pointer of its own is drawn on the page. Before a
  click it glides from where it was to the target in about a quarter of a second, then a ripple
  marks the click. Before typing, the field is outlined. A drag shows the pointer travelling with
  the button held. The pointer fades a few seconds after the agent's last action. The user's own
  mouse is never moved or blocked, and the user can still click in the page.
- _A frame while the agent is in control._ A thin coloured frame around the pane while the agent
  is acting, drawn by Kucedr around the page, not inside it. It replaces the small dot in the
  toolbar (`src/renderer/src/pages/home/browser/Toolbar.tsx`) as the main signal.
- _Builds on._ `act.ts` already knows the target point before every click, hover and drag, and
  sends the pointer there in one step. The cursor is a small script run in the page before the
  action, the same way the page outline is (`snapshot.ts`).
- _Where it is drawn._ Recommended: inside the page, as an element the page cannot click or read
  into, added by the main process. The alternatives do not fit: Kucedr's own window is drawn
  underneath the page, so it cannot draw over it; a second transparent view on top would take the
  user's clicks _(not verified)_; the browser's built-in element highlighter can outline a target
  but cannot show a moving pointer.
- _Rules._
  - **Never in what the model sees.** The pointer and ripple are removed before a screenshot and
    left out of the page outline, so the model does not mistake them for page content.
  - **Cheap to draw.** Movement and fade only; no animated glow. A pulsing glow frame in a similar
    product was reported to keep the graphics processor busy for as long as it showed.
  - **Reduced motion.** With the system's reduce-motion setting, the pointer appears at the
    target without gliding and there is no ripple.
  - **Only in the pane.** Background runs draw nothing.
  - **For the user's eyes.** It is not meant to make the agent look human to sites that block
    automation.
- _Cost._ Each click waits for the glide, about a quarter of a second. Measured turns are
  dominated by the model call, so this is small, but a setting to turn the effect off is cheap.
- _Open decisions._
  - Recommended: also send the page a few real pointer moves along the path, so menus that open on
    hover behave as they do for a person. Without this the effect is a picture only.
  - Whether the pointer shows a short label of the action ("Click", "Type"). Recommended: no; the
    chat already lists each step.
- _Reference._ How the Claude desktop app draws its pointer could not be confirmed from public
  sources. What was found: the Claude in Chrome extension shows a pulsing frame around a page it
  controls; ChatGPT's agent and Codex computer use show a second, agent-owned pointer; and test
  tools draw a pointer dot and click ripple inside the page, which is the approach recommended
  here.
- _Check._ Ask the agent to click a link and fill a form: the pointer travels to each target and
  the click is marked; a screenshot taken by the agent shows no pointer; the user can click in the
  page while the pointer is visible; with reduce-motion on, nothing glides.

## Interface polish

Added 2026-11-25 from a read of `src/renderer/src`. Paths below are relative to that folder. None of
these items were checked in the running app.

### 3.13 Confirmations in the app's style

Built 2026-11-26. All renderer confirmations now use the shared themed dialog in
`components/ui/confirmation.tsx`, built on the existing dialog component. It follows the app theme,
uses translated copy, focuses Cancel by default, and closes without confirming on Escape. Delete,
clear and regenerate actions keep their existing warning text and now have named action buttons.
Verified by a source search: no `window.confirm` remains under `src/renderer`. The undo improvement
for deletions that can be restored remains a separate follow-up to 3.7.

### 3.14 Consistent empty and loading states

- _Behaviour._ Empty and loading states use the shared settings placeholders. Added them to plugin
  discovery and filtering, permission locations, browser profiles, knowledge search results and
  embedding model selection, cloud backup folders, MCP tool configuration and account activity.
  Existing cloud and permissions loading placeholders remain in use.
- _Builds on._ `SettingsEmptyState`, `SettingsLoadingRows` and `components/ui/empty.tsx`.
- _Verification._ Typecheck and targeted ESLint pass. Empty and loading states were not visually
  checked in the running app; other Settings pages may still have list-like content that needs a
  separate review.
- _Kept out._ New illustrations. The existing icon-and-text pattern is enough.
- _Check._ With a fresh profile, every Settings page with a list shows the shared empty state.

### 3.15 A visual consistency pass

- _Behaviour._ Nothing visibly new. Pages stop drifting apart: colours follow the theme in light,
  dark and [plugin themes](../PLUGIN_THEMES_PLAN.md), and text sizes come from one scale.
- _Found._ 41 fixed palette colours such as `bg-blue-500` across 11 files, most in
  `pages/settings/pages/library/Selection.tsx` and `pages/settings/components/theme.tsx`; these do
  not follow a theme. 59 fixed pixel sizes, most often `text-[13px]` (16 uses).
- _Approach._ Replace each fixed colour with the theme colour that means the same thing
  (`primary`, `destructive`, `muted`), and each fixed text size with the nearest step on the
  scale. Colours that show a theme itself (the swatches in `theme.tsx`) stay fixed.
- _Open decision._ Whether 13px should become a named step on the scale, since it is used so often.
  Recommended: yes, rather than rounding 16 places to 12 or 14.
- _Check._ Switching between light, dark and one plugin theme leaves no element in the old colours.

### 3.16 A useful empty chat

Built 2026-11-26. The empty chat shows a translated time-of-day greeting and three localized prompt
starters. When a prior chat exists, it also offers “Continue: <title>”. Selecting any suggestion
fills and focuses the composer without sending it. Suggestions are static and make no model request.
Typecheck, targeted ESLint and translation JSON parsing pass; a fresh-profile visual interaction
check was not performed.

### 3.17 Smoother first-run setup

Built 2026-11-26. Setup now goes through model provider, chat assistant, then an optional extras
screen with Plugins and Voice tabs. **Skip for now** saves valid selections, verifies the required
chat configuration and opens Home. Step titles, descriptions, progress labels and setup actions are
translated in English and Italian. Plugins and voice remain available in Settings. Typecheck,
targeted ESLint and translation JSON parsing pass; a fresh-profile run was not performed.

### 3.18 Find any setting

- _Behaviour._ Typing in the command menu matches the names of individual options, not only page
  titles. Choosing one opens the page and scrolls to the option, briefly highlighted.
- _Found._ The command menu (`experience/CommandMenu.tsx`) builds its Settings entries from
  `SETTINGS_NAVIGATION` (`pages/settings/navigation.ts`), which holds pages, not options.
- _Approach._ Give each option an id and its label key, listed next to its page in the navigation
  data, so the menu and the page share one list. No separate search box in Settings.
- _Check._ Typing "sound" offers the sound switch and lands on it.
