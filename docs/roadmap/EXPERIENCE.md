# 3. User experience

Part of the [Roadmap](README.md). Status: proposal; 3.1, 3.3, 3.9 and 3.12 are built, and 3.11 except its off switch (see each row).

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 3.1 | Completion notifications | A system notification and dock badge when a background run, task or approval needs attention | Built 2026-11-21–22 (`src/main/notifications`): finished, failed and waiting chats, finished or failed tasks, health checks that need attention; a badge count; clicking opens the chat; a switch in Settings → General. Not checked in the running app | S |
| 3.2 | Search across chats | Find any message in any chat from one search box | `src/renderer/src/pages/home/Search.tsx` searches the open chat only | M |
| 3.3 | Regenerate and retry | Re-run a reply, or retry a failed one, from the message | Built 2026-11-21: Regenerate in the message actions with a confirmation, Retry on a failed reply (`AssistantMessage.tsx`, `useHomeAgent.ts`). Not checked in the running app; messages with attachments not verified | S |
| 3.4 | Complete the "/" menu | Skills and task commands appear in the menu that already opens on `/` | `PromptSlash` lists modes, apps, settings pages and themes; skills and task commands are typed from memory | S |
| 3.5 | Shortcut guide | One screen listing every shortcut, fed by a single list | Shortcuts are defined in four places; three of them do nothing today | M |
| 3.6 | Offline and failure states | A clear message and a retry when offline, when a chat fails to load, or when a rename fails | No online check anywhere | S |
| 3.7 | Undo and archive view | Undo after delete or archive; a place to see archived chats _(whether one exists is not verified)_ | Pin, archive and categories exist | S |
| 3.8 | Attachment checks | A warning before sending a file the model cannot read or that is too large | Listed as missing in [FEATURES.md](../FEATURES.md) | S |
| 3.9 | Browser pane | When the agent uses the browser tool, the page appears in a resizable pane on the right of the chat instead of a separate Chrome window | Built for interactive runs: each tab is its own web view placed over the pane; see "As built" in the [Embedded agent browser plan](../AGENT_BROWSER_PLAN.md) and [Status](BROWSER.md#status) in Browser import | L |
| 3.10 | Chat export, import and sharing | Export a chat as Markdown, HTML or PDF; import chats from other assistants; later, share a chat by link | Export exists for workspace documents only (`src/main/export.ts`); a share link needs a server and is a later decision | S–M |
| 3.11 | Agent cursor in the browser pane | A pointer glides to where the agent is about to click, marks the click, and shows what it is typing into, so the user can follow what the agent does on the page | The pane's click and type actions (`src/main/agent/tools/web/browser/act.ts`); built, except the setting to turn it off; see "As built" in the [browser plan](../AGENT_BROWSER_PLAN.md) | S–M |
| 3.12 | Browser control from the chat | "Click Sign in on this page" acts on the tab on screen; follow-up messages continue in the same tab; the agent never closes the user's tabs; scroll, reload, and Stop in the pane; see [Browser control plan](../BROWSER_CONTROL.md) | Built 2026-11-23: the tab on screen is used first, tabs list `shown` and `mine`, the agent closes only tabs it opened in that chat, `scroll`, `reload`, and Stop in the pane toolbar; checked in the built app, including after a restart. Not checked: task runs, two chats acting at once, two windows; see [Status](../BROWSER_CONTROL.md#status) | M |

The terminal panel has its own area: [Terminal](TERMINAL.md).

The browser pane later carries [Tor tabs](TOR.md) and [private and VPN tabs](VPN.md), and can
[import from other browsers](BROWSER.md).

## User experience in detail

Suggested order for what is left: 3.4, 3.2, 3.5. 3.1, 3.3 and the browser pane (3.9) are built.

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

- _Behaviour._ One screen, opened from the Help menu and the command menu, listing every shortcut
  by area. The same list drives the menu and the key handlers, so the guide cannot go stale.
- _Found on the way._ ⌘K, ⌘D and Ctrl+Alt+N are captured and do nothing: `src/main/shortcuts.ts`
  forwards them to the window as `app:shortcut` and nothing listens. Decide what each does or
  remove them. ⌘K usually opens a command menu; here that is on ⌘F.
- _Builds on._ `SHORTCUT_ACCELERATORS` in `src/shared/app_types.ts`; `CommandShortcut` in
  `src/renderer/src/components/ui/command.tsx` for key labels.
- _Constraint._ Keys must work on non-US layouts, as zoom already does by registering both ⌘+ and
  ⌘=.
- _Kept out._ Rebinding keys.
- _Check._ Every shortcut in the guide works, and no working shortcut is missing from it.

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
