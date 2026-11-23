# Browser pane: controlling the browser from the chat

Status: built 2026-11-23; see [Status](#status). Roadmap item 3.12 in
[User experience](roadmap/EXPERIENCE.md). Paths are relative to `src/main/` unless they start with
`src/` or `docs/`. The sections below are the plan as written; where the code turned out
different, [Status](#status) says so.

## Status

Built and checked on macOS in the built app (isolated profile, mock model issuing the browser
calls, local test pages).

### What the plan got wrong about the code

- **Tabs already belonged to the chat, not the run.** A chat run's `ownerId` is
  `interactive:<chat>` (`agent/agent.ts`); `run:<runId>` is only the fallback in
  `agent/runner/run_tool_call.ts`. What really failed was the tab on screen being ignored.
- **Tabs the user opens are never "no chat".** The + button and the first tab pass the chat on
  screen (`command.ts`, `src/renderer/src/pages/home/Page.tsx`), so "this chat's tab" cannot tell
  the user's tabs from the assistant's. A new `agent` flag on each tab does that.

### As built

- **Tab choice** (`agent/tools/web/browser/run.ts`), without a `targetId`:
  1. the tab this reply already used (`owner` is now the run id);
  2. the tab on screen, focused window first (`agent/tools/web/browser/shown.ts`), unless another
     chat's agent is acting in it;
  3. this chat's last used tab;
  4. the only tab, under the same condition as 2;
  5. otherwise an error listing the tabs.

  Step 1 keeps a multi-step reply in its own tab when the user switches tabs midway. The tab the
  agent acts on moves to its chat, so the last chat to act owns it.
- **Opened by the assistant.** `agent` on `BrowserTab` (`pane.ts`) is set when the agent opens a
  tab or a page it drives opens a popup. It is saved in `tabs.json` (`browser/snapshot.ts`,
  `browser/restore.ts`), so it survives a restart. A tab the user opens with + no longer takes the
  agent's run as its owner.
- **`tabs` and `status`** give `shown` and `mine` for each tab.
- **`close`** without a `targetId` closes this chat's last tab the assistant opened. Any tab the
  assistant did not open in this chat fails with "only the user can close it". **`stop`** closes
  only this chat's assistant tabs.
- **`act` `scroll`** (`act.ts`): with a `ref`, scrolls it into view; otherwise `direction` and
  `amount` in screens, sent as a mouse wheel at the agent pointer or the page centre, so inner
  lists scroll too. **`navigate` `reload`.** Both also work in the background headless browser
  (`use_web_browser.ts`).
- **Stop in the pane** (`Toolbar.tsx`, `Pane.tsx`): a Stop button in the toolbar while the agent
  of the chat on screen acts in the tab shown. It calls the chat's own Stop (`stopResponse`), so
  the chat view updates as if Stop had been pressed there. The page is left as it was. Its label is
  in English only, like the rest of the toolbar.
- **Description** rewritten for the pane with no product names. `background.ts` keeps its own,
  which still says "headless Chrome", and Chrome is what it launches.

### Checked in the app

- With the agent's tab and a hand-opened tab of another chat on screen, `tabs` marked the second
  `shown: true, mine: false`. `snapshot` and a `click` in a follow-up message went to that tab, and
  the click followed its link. The tab then belonged to this chat.
- `scroll` down 2 moved the page two screens (1428 px at a 714 px viewport); `scroll` to a ref put
  the link at the bottom of a long page into view; `reload` loaded the page again.
- `close` closed the assistant's tab and refused the user's; `stop` closed only the tab the
  assistant had opened and left the user's.
- Stop in the pane appeared while the agent waited, and ended the run about half a second after
  the click. The frame went away and the page stayed.
- After a quit and relaunch, with the pane hidden, a follow-up message acted in this chat's
  restored tab (its page was restored first) and could still close it; the other chat's tab stayed.

### Not checked

- A task run with the browser tool. The headless path only gained `scroll` and `reload` and
  typechecks.
- Two chats acting at once: the tab on screen being skipped while another chat's agent acts in it.
- Two windows: the focused window's tab winning.
- Stop for another chat's agent. The pane shows Stop only for the chat on screen, because a run
  can be cancelled only from the window that started it; the user stops other chats from those
  chats.
- Windows and Linux.

### Still open

- **`evaluate` approval on a page where a password was filled.** Today `evaluate` is refused on
  such a page (`tab.filled` in `act.ts`), which is stricter than an approval. Left as is.

## Goal

From the chat the user can say "open the site", "click Sign in", "fill this form", "go back",
"what does this page say", and the agent does it in the pane the user is looking at, across
several messages, without the user naming tabs. The user can stop it at any moment, and the agent
never closes the user's own tabs.

## What already works

The agent already drives the pane. A chat run calls `use_web_browser`
(`agent/tools/web/use_web_browser.ts`), which in an interactive run hands off to
`agent/tools/web/browser/run.ts`:

- `open`, `navigate` (address, back, forward), `focus`, `close`, `tabs`, `status`;
- `snapshot` (page text and numbered elements), `screenshot`, `pdf`, `console`;
- `act`: `click`, `type`, `press`, `hover`, `drag`, `select`, `fill`, `wait`, `evaluate`
  (`agent/tools/web/browser/act.ts`), with the agent cursor drawn on the page
  (`agent/tools/web/browser/cursor.ts`, 3.11).

The tool is always attached to chat runs (`agent/runner/run_stream.ts`), and the prompt marks it
"explicit user request only" (`agent/system/explicit.ts`), so the agent uses it when asked to.
Background runs (tasks, health) get a separate headless browser
(`agent/tools/web/browser/background.ts`) and never touch the pane.

## What is missing

1. **The agent does not know which tab the user is looking at.** With no `targetId`, `run.ts`
   picks the last tab whose `owner` is this run, else the only tab, else fails with "Several tabs
   are open and none was opened by this chat". The tab on screen (`paneShown` in
   `agent/tools/web/browser/pane.ts`) is never considered, and the `tabs` list does not say which
   tab is on screen. "Click Sign in on this page" fails as soon as two tabs are open.
2. **A tab belongs to one run, not to the chat.** `owner` is `run:<runId>`
   (`agent/runner/run_tool_call.ts`). The next message in the same chat is a new run, so it no
   longer owns the tab it opened a minute ago and hits the same error. Restored tabs
   (23.17) have no owner at all.
3. **`stop` closes every tab.** It closes all tabs in the pane: the user's, other chats', and
   restored ones.
4. **The agent can close any tab.** `close` with any `targetId` closes it, including a tab the user
   opened.
5. **No scrolling and no reload.** There is no way to scroll a long page or a list except pressing
   keys, and no reload.
6. **The user's only stop is in the chat.** While the agent acts, the pane shows an outline but no
   way to stop it from the pane.
7. **The tool description names a product.** It says "Drive a real Chrome browser", but the pane is
   Kucedr's own embedded browser; only background runs use an installed browser.

## Features

### Which tab the agent acts on

Without a `targetId`, the agent acts on, in this order:

1. the tab shown in the pane, if it belongs to this chat or to no chat yet;
2. the tab this chat used last (highest `order` among tabs whose `chat` is this chat);
3. the only open tab;
4. otherwise it fails and lists the tabs, so the model can pass a `targetId`.

"Shown" means the tab in `paneShown` for the focused window, else any window. A tab the user
opened by hand belongs to no chat until an agent acts on it, then to that chat (as `run.ts` already
does with `owner`).

### Tabs belong to chats

Ownership moves from `owner` (the run) to `chat` (the session), which every tab already carries and
23.17 already saves. A follow-up message continues in the same tab, after a restart too. `owner`
stays only for what needs the run: the "assistant is using this page" outline and `acting`.

### What `tabs` and `status` tell the model

Each tab: `targetId`, `url`, `title`, `shown` (on screen now), `mine` (belongs to this chat). The
model can then answer "which tab?" without guessing.

### Closing is limited

- `close` without a `targetId` closes this chat's current tab. With a `targetId`, only a tab that
  belongs to this chat; any other tab fails with a message saying the user can close it.
- `stop` closes this chat's tabs only, and leaves the pane open if other tabs remain.

### Scroll and reload

- `act` gains `scroll`: to an element (`ref`) or by a direction and amount (`up`, `down`, `left`,
  `right`, in screens), using the page's own scrolling so lazy lists load.
- `navigate` gains `reload`.

### Stop from the pane

While this chat's agent is acting, the pane toolbar shows Stop next to the outline. It cancels that
chat's run, the same way the chat's Stop does (`agent.cancel`), and leaves the page as it is so the
user can carry on by hand.

### The tool description

Rewritten for the pane: the user sees the page beside the chat; "this page" means the tab on
screen; snapshot before acting; refs change after navigation; the user may click and type in the
same page, so snapshot again after waiting for them. No product names. The headless background
browser keeps its own description in `background.ts`.

## Kept out

- **Uploading files to a page** (a file field). It needs a read permission check on the chosen
  file and a file chooser handler; a later item.
- **Downloads.** They are cancelled today (`create.ts`) and wait for the
  [Network shield](roadmap/SHIELD.md).
- **An approval for every click.** The agent acts only on request, the user watches it, and Stop is
  one click away. Approvals stay as they are: `evaluate` counts as `execute`
  (`agent/execution/capability.ts`).

## Files

Changed: `agent/tools/web/browser/run.ts` (tab choice, `stop`, `close`, `reload`, the tab list),
`act.ts` (`scroll`), `use_web_browser.ts` (input schema and description), `pane.ts` if a helper for
the shown tab is needed, and `src/renderer/src/pages/home/browser/Toolbar.tsx` (Stop). New, one
function each if needed: `agent/tools/web/browser/shown.ts` (the tab on screen).

## Open decisions

- **Acting on the user's own tab.** Recommended: allowed when the user asks in the chat ("click
  Sign in here"), since the tab on screen is what they mean. The alternative, the agent always
  opening its own tab, is safer but makes "this page" requests impossible.
- **Pages with a password filled in.** Recommended, as already listed in
  [Browser import](roadmap/BROWSER.md#open-decisions): `evaluate` needs an approval on a page
  where Kucedr filled a password. It matters more once the agent works in the user's tabs.
- **A tab used by two chats.** Recommended: the last chat to act owns it; the outline shows which
  chat is acting.

## Checks

In the built app, isolated profile, a mock model that issues the browser calls.

- With two tabs open by hand and the second on screen, "click the first link" clicks in the second
  tab.
- A follow-up message in the same chat continues in the tab the first message opened, also after a
  restart.
- `tabs` marks the tab on screen and this chat's tabs.
- `stop` and `close` leave tabs the user opened and other chats' tabs open; closing another chat's
  tab fails with a clear message.
- `scroll` down on a long page moves it; `scroll` to a ref brings that element into view; `reload`
  reloads.
- Stop in the pane toolbar ends the run, and the page stays as it was.
- A task run with the browser tool still uses the headless browser and does not open a pane tab.
