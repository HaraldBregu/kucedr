# Browser pane: tabs that survive a restart, history, and safe bookmarks

Status: built 2026-11-23; see [Status](#status). Roadmap items 23.17–23.20 in
[Browser import](roadmap/BROWSER.md). Paths are relative to `src/main/` unless they start with
`src/` or `docs/`.

## Status

All four items are built and checked on macOS in the built app (Playwright `_electron`, isolated
profile, a mock model for the agent visit).

### Checked in the app

- **Crash** (process killed) and **Quit**: the same three tabs in the same order, the same tab in
  front; at start only that tab's page is requested, another loads when its tab is shown; Forward
  then Back work in the tab that had history. A change made 0.3 s before quit is saved.
- **Reorder**: third tab to first and first to the end; the dragged tab comes to the front and the
  others make room while dragging. Keyboard ⌘⇧← moves the focused tab and keeps focus on it;
  Ctrl+Shift+← does nothing on macOS. The "All tabs" menu and a second window follow the strip;
  the order survives a crash. Dropping a tab on the composer or the chat list changes nothing.
- **Damaged library**: invalid text in `library.json` → bookmarks come back from `.bak`, the damaged
  file is kept as `library.json.damaged-<time>`, a new bookmark keeps the others, also after a
  relaunch.
- **Clearing**: both buttons raise the native warning first; Cancel changes nothing; "Clear
  history" leaves the bookmarks.
- **Export**: the exported file imports back with the same four bookmarks, titles with `& < > "`
  included.
- **History**: three pages opened by hand appear in History and in the address field suggestions;
  the page the agent opened does not; deleting one removes it from both; old history in
  `library.json` moves to `history.json` and the next bookmarks write leaves it out. English and
  Italian checked. 5,000 entries render in about 1 s, search filters in under 0.1 s.
- **Cost of unloaded tabs**: 30 restored tabs use about 22 MB more than one, with no extra
  renderer process, so pending tabs keep their view.

### Not checked

- A real pointer drag and the strip scrolling at its edges: Playwright's mouse does not start a
  native drag in Electron, so the drag was driven with drag events sent to the strip.
- The flush before rename (`fsync`) cannot be observed from a test; checked by reading the code.
- Windows and Linux.

### Differences from the plan

- The start-up restore and the quit writes are in `runtime.ts`, not `index.ts`: `index.ts` only
  takes the single-instance lock and imports `runtime.ts`.
- `.bak` is one write behind, so after a damaged file the last change before the damage is lost.
- Showing a restored tab counts as a visit of its page, since its load is a normal navigation.
- `library.json` is written without `history`; the move happens when `library.json` is first read
  (it writes `history.json` if that does not exist), so a bookmark change made before any history
  read cannot drop the old history.
- `history.json` and `tabs.json` that cannot be read are set aside like the library.
- The keyboard move is ⌘⇧← / ⌘⇧→ on macOS and Ctrl+Shift+← / → on Windows and Linux. Arrows sit in
  the same place on Italian and US layouts, and nothing in `shortcuts.ts` or the menu uses them.

## Goal

- After a crash or a normal quit, opening Kucedr brings back the browser pane's tabs as they were:
  same pages, same order, the same tab in front, and Back still works.
- Pages the user visits in the pane are kept as a history, searchable and deletable.
- Bookmarks cannot be lost to a crash, a damaged file or one wrong click.
- Tabs can be dragged to a new place in the tab strip, and that order is what a restart restores.

## What the code does today

- **Tabs live only in memory.** `agent/tools/web/browser/pane.ts` keeps them in `paneTabs`, a
  `Map`. Nothing writes them anywhere, so every quit or crash loses them. Each tab has a chat id,
  an order (the highest is in front) and a `WebContentsView` in the persistent
  `persist:agent-browser` session, so cookies and sign-ins already survive a restart; the tabs do
  not.
- **Browsing records no history.** History is only what an import brought in
  (`browser/import.ts`). `browser/library.ts` holds it, with the bookmarks and the search engine,
  in one file, `~/.kucedr/browser/library.json`.
- **A damaged library file wipes the bookmarks.** `library()` falls back to an empty library when
  the file cannot be read, and the next write (any bookmark change, any import) saves that empty
  library over the damaged file. This is the same gap already listed for passwords in
  [Browser import](roadmap/BROWSER.md#open-decisions): "never overwrite a store that cannot be read".
- **The write is atomic but not flushed.** `browser/write.ts` writes a temporary file and renames
  it over the old one, so a crash mid-write leaves the old file. It does not flush the temporary
  file to disk first, so after a power cut the renamed file can be empty on some file systems.
- **One click clears everything.** Settings → Browser → Clear
  (`src/renderer/src/pages/settings/pages/browser/Page.tsx`) deletes all bookmarks and all history
  at once, with no confirmation.
- **The agent cannot read these files.** `agent/permissions/protected.ts` already denies reads and
  writes of `~/.kucedr/browser`.
- **The strip shows tabs in the order they were created.** `tabs()` (`agent/tools/web/browser/tabs.ts`)
  lists `paneTabs` in insertion order, and `BrowserTabs`
  (`src/renderer/src/pages/home/browser/Tabs.tsx`) draws them in that order. A tab's `order` field
  is something else: the most recently focused tab has the highest, and that tab is the one in
  front. There is no field for a tab's place in the strip, and no way to move one.
- **Drag and drop elsewhere uses the browser's own drag events.** The Home sidebar moves chats
  between categories with `draggable` and `dataTransfer` (`src/renderer/src/pages/home/Sidebar.tsx`),
  with no library.
- **Electron can restore a tab's Back and Forward list.** Electron 44 has
  `navigationHistory.getAllEntries()`, `getActiveIndex()` and `restore({ entries, index })`.

## 23.19 Bookmarks that cannot be lost

Comes first: it protects what is already stored, and the other two items write more often to the
same folder.

- **Never overwrite what cannot be read.** When `library.json` does not parse, read the previous
  copy (below). When that fails too, rename the damaged file to
  `library.json.damaged-<date>` before starting empty, so nothing is overwritten and the user's
  data can still be recovered by hand.
- **Keep the previous copy.** Before each write of `library.json`, copy the current file to
  `library.json.bak`. Bookmark changes are rare, so the extra copy costs nothing noticeable.
- **Flush before rename.** `writeFileAtomic` opens the temporary file, writes, calls `fsync`, then
  renames. Every store using it benefits, passwords included.
- **Separate, confirmed clearing.** Replace the single Clear with "Clear history" and "Delete all
  bookmarks", each behind the native confirmation that passwords already use
  (`browser/confirm.ts`).
- **Export bookmarks.** Settings → Browser → Bookmarks → Export writes the standard bookmarks HTML
  file every browser can import, and Kucedr's own import already reads it. This pulls the export
  part of 23.15 forward; it is the user's own copy, outside Kucedr.

## 23.17 Tabs restored after a crash or quit

### What the user sees

Kucedr opens with the pane showing the same tabs as before, the front tab in front. Only the tab on
screen loads; the others load when the user clicks them, as other browsers do, so a restart with
many tabs is not slow and does not hit every site at once. Back and Forward work in every restored
tab.

### What is saved

`~/.kucedr/browser/tabs.json`, written with `writeFileAtomic`:

```json
{
  "saved": 1795400000000,
  "tabs": [
    {
      "chat": "<chat id>",
      "order": 12,
      "entries": [{ "url": "https://example.com/", "title": "Example" }],
      "index": 0
    }
  ]
}
```

- `entries` and `index` come from `navigationHistory.getAllEntries()` and `getActiveIndex()`,
  capped at the last 50 entries per tab and 100 tabs.
- `pageState` (scroll position and form values) is dropped; see the open decisions.
- Left out: entries that are not `http` or `https`, empty tabs, and later private and Tor tabs
  ([Private and VPN browsing](roadmap/VPN.md), [Tor](roadmap/TOR.md)). The agent's run (`owner`)
  is not saved; a restored tab belongs to its chat but to no run.

### When it is written

- On the pane's existing `change` event (`paneEvents`), at most once a second, and only when the
  saved content differs from the last write. `change` fires for loading, titles and icons, which
  do not change the file, so most events write nothing.
- Once more on `before-quit`.
- A crash therefore loses at most the last second of tab changes.

### How it is restored

- At start, after the app is ready and before the first window is shown, main reads `tabs.json` and
  creates each tab with `createTab(chat)` but loads nothing. The tab keeps its saved `entries` and
  `index` as a pending restore, and `tabs()` reports the pending entry's address and title, so the
  tab strip looks right at once.
- A pending tab loads with `navigationHistory.restore({ entries, index })` the first time it is
  shown (the `BrowserChannels.view` handler in `ipc/browser.ts`) or the first time the agent acts
  on it.
- Restored tabs open the pane at start, because Home shows the pane whenever there are tabs
  (`src/renderer/src/pages/home/Page.tsx`). Nothing changes in the renderer.
- A missing or unreadable `tabs.json` restores nothing and is renamed aside, like the library.

### Files

New, one function each, in `browser/`: `snapshot.ts` (build and write the saved list), `restore.ts`
(read it and create pending tabs at start), `wake.ts` (load a pending tab). Changed: `pane.ts` (a
`pending` field on the tab), `tabs.ts` (report the pending address and title), `ipc/browser.ts` and
the place the agent picks its tab (call `wake`), and `index.ts` (start the restore, register the
quit write).

## 23.18 Browsing history

### What the user sees

- Pages the user opens in the pane appear in the address field suggestions, which already read
  history (`browser/suggest.ts`).
- Settings → Browser → History lists visits by day, newest first, with search, delete one, and
  "Clear history" (from 23.19).

### How it is recorded

- On `did-navigate` and `did-navigate-in-page` for the main frame, with an `http` or `https`
  address, the visit is added or updated: the visit count goes up and `last` becomes now. A later
  `page-title-updated` fills in the title without counting a new visit.
- Visits made while the agent is acting in that tab's chat are not recorded; see the open
  decisions.
- History moves to its own file, `~/.kucedr/browser/history.json`, so the bookmarks file is no
  longer rewritten on every page visit. Writes are batched, at most once every two seconds and on
  quit. The existing limit of 5,000 entries (`HISTORY_LIMIT`) stays; the oldest by `last` go first.
- Imports write history to the new file.

### Moving existing history

The first time history is read and `history.json` does not exist, it is read from `library.json`.
The next write of `library.json` leaves the `history` field out. The app does this when it reads
the file; no script edits `~/.kucedr`.

### Files

New, in `browser/`: `history.ts` (read and write the history store), `visit.ts` (record one visit).
Changed: `agent/tools/web/browser/create.ts` (call `visit` from the navigation events),
`library.ts`, `import.ts`, `suggest.ts`, and a History page under
`src/renderer/src/pages/settings/pages/browser/`.

## 23.20 Drag tabs to reorder

### What the user sees

- Dragging a tab along the strip moves it; the other tabs make room where it will land, and
  dropping puts it there. The dragged tab comes to the front, as clicking it would.
- The strip scrolls when a tab is dragged to its edge, since it already scrolls when crowded.
- Keyboard: with a tab focused, a modifier plus Left or Right moves it one place. The key is fixed
  together with the shortcut list ([User experience](roadmap/EXPERIENCE.md), 3.5) and must work on
  non-US layouts. This is the keyboard path [Accessibility](roadmap/ACCESSIBILITY.md) 4.2 asks for.
- The "All tabs" menu lists tabs in the same order as the strip.

### How it is built

- **A place in the strip, kept in main.** The tab gets a `position` number, separate from `order`.
  A new tab is placed at the end; a tab a page opens (`setWindowOpenHandler` in `create.ts`) is
  placed at the end too, as today. `tabs()` returns tabs sorted by `position`.
- **One new pane command.** `BrowserPaneCommand` (`src/shared/browser.ts`) gains `move` with the
  target tab and the index to land at. `command.ts` renumbers positions and emits `change`, which
  every window already listens to, so all windows show the new order. `ipc/browser.ts` checks the
  index in its schema.
- **Drag in the renderer, no library.** `Tabs.tsx` uses the same `draggable` and `dataTransfer`
  pattern as the sidebar, with its own data type so a tab cannot be dropped on a chat list or the
  composer. While dragging, the strip shows where the tab will land; on drop it sends `move`. The
  strip already sits in a `no-drag` area inside the window's drag region, so dragging a tab does
  not move the window.
- **Saved with the tabs.** `tabs.json` (23.17) stores the tabs in strip order, so a restart keeps
  the order without a new field.

### Kept out

Dragging a tab out of the strip into its own window, and dragging tabs between windows. The pane
is one browser shared by every window and chat, so there is nowhere separate to drop it.

### Files

Changed: `agent/tools/web/browser/pane.ts` (the `position` field), `create.ts` (set it),
`tabs.ts` (sort by it), `command.ts` and `src/shared/browser.ts` (`move`), `ipc/browser.ts`
(schema), and `src/renderer/src/pages/home/browser/Tabs.tsx` (drag and keyboard).

## Rules the design keeps

- Nothing new is sent off the machine; all three files stay in `~/.kucedr/browser`, which the agent
  cannot read.
- No new dependencies.
- Private and Tor tabs, when they exist, are never recorded or restored.
- Encrypted data at rest ([Privacy](roadmap/PRIVACY.md), 1.3) covers `tabs.json` and
  `history.json` when it is built.
- With separate workspaces ([Multiple workspaces](roadmap/WORKSPACES.md), 10.3), the whole
  `browser` folder becomes per workspace; nothing here assumes there is only one.

## Open decisions

Decided 2026-11-23 as recommended below: history moves to `history.json`; tabs are always restored,
no setting; only the user's visits are recorded; `pageState` is dropped; 5,000 entries, no time
limit; restored tabs keep a view each (measured above).

- **Moving history out of `library.json`.** Recommended: yes, so bookmarks are not rewritten on
  every visit. It changes saved data, which the project calls out as a decision. Without the move,
  23.19 still protects the bookmarks, but every visit rewrites them.
- **Restore always, or ask.** Recommended: always, with no setting in the first version. A switch
  in Settings → Browser ("Reopen tabs at start") can follow if wanted.
- **Agent visits in history.** Recommended: user visits only, so the address field does not
  suggest pages the agent opened for research. The alternative records everything and labels the
  agent's visits.
- **Keep `pageState`.** Recommended: drop it. It would restore scroll position, but it also holds
  form values typed into pages, which should not sit in a plain file. Not verified what Chromium
  keeps in it for password fields.
- **History retention.** Recommended: keep the 5,000-entry limit and no time limit for now; a
  "keep history for" setting belongs to storage management ([Privacy](roadmap/PRIVACY.md), 1.7).
- **Cost of unloaded tabs.** Creating a view for each restored tab before it loads is the simple
  path. Its memory cost is _not measured_. If 50 restored tabs cost too much, keep pending tabs as
  records only and create the view on first show.

## Order

1. 23.19 (S): safe read, previous copy, flush, confirmed clearing, export.
2. 23.17 (M): save and restore tabs.
3. 23.20 (S): drag to reorder. Can also go first; it does not depend on the others, and if it
   lands after 23.17 the saved order already follows the strip.
4. 23.18 (M): record history, move it to its own file, History page.

## Checks

Run in the built app with an isolated profile and a mock model.

- **Crash.** Open three tabs, go back once in one of them, kill the app process, relaunch: the same
  three tabs in the same order with the same tab in front; only that tab loads; Back and Forward
  work in the one that had history.
- **Quit.** The same after a normal quit.
- **Reorder.** Drag the third tab to the first place: the strip and the "All tabs" menu show the new
  order, a second window shows it too, and the order survives a crash and relaunch. The keyboard
  move does the same. Dragging a tab onto the chat list or the composer does nothing.
- **Damaged library.** Replace `library.json` with invalid text in the test profile and launch: the
  bookmarks come back from `library.json.bak`, the damaged file is kept beside it, and adding a
  bookmark does not lose the others.
- **Clearing.** "Clear history" leaves bookmarks untouched; both buttons ask first.
- **Export.** The exported file imports back into Kucedr with the same bookmarks.
- **History.** Three pages opened by hand appear in History and in the address field suggestions;
  a page the agent opened does not; deleting one removes it from both.
