# 23. Browser import

Part of the [Roadmap](README.md). Status: in progress; see [Status](#status).

The browser pane can bring in what the user already has in Chrome, Firefox and other browsers:
bookmarks, history, saved passwords, signed-in sessions and the few settings that apply. The user
does not start again from an empty browser.

## Status

Updated 2026-11-20. Everything under "Implemented" was checked on macOS in the built app, unless
it says otherwise. Windows and Linux paths are written but not exercised.

### Implemented

- **The pane.** Every tab is a web view in one permanent session, `persist:agent-browser`
  (`src/main/agent/tools/web/browser/create.ts`), with Chrome-style tabs, favicons, a scrolling tab
  strip with an "All tabs" menu, and a toolbar and tab strip that drag the window. One browser is
  shared by every chat: switching chats keeps it open with all tabs, "Hide browser" hides it for
  all chats, and it is hidden only while Settings is open. The "assistant is using this page"
  outline shows only when the acting agent owns the tab on screen.
- **23.1 Import screen** (Settings → Browser). Finds every browser profile on the machine by the
  files its engine writes, with no list of products; imports bookmarks, history and the search
  engine; a second button takes any file or folder. Running it again adds no duplicates.
- **23.2 Bookmarks and history**, kept in `~/.kucedr/browser/library.json`, suggested under the
  address field, with a bookmarks menu in the toolbar. A profile with only `Bookmarks.bak` is read
  from the backup.
- **23.3 + 23.4 Passwords from a CSV export**, columns matched by meaning, so any browser's or
  password manager's export works.
- **23.6 Search from the address field** with the imported engine, or DuckDuckGo.
- **23.9 Autofill list on login fields.** Drawn in a closed shadow root in Kucedr's private script
  world (`autofill.ts`); the page cannot read it, and only a real click or key counts. Each row
  shows a key icon, the username, its site ("Saved for accounts.example.com" for a related host)
  and dots for the password. The list narrows as the user types in the username field, follows the
  pointer on hover, flips above the field when there is no room below, scrolls when long, closes on
  Escape, Tab or a click elsewhere, and reopens on a click back into the field. Its last row,
  "Manage passwords…", opens Settings → Browser → Passwords. A toolbar key button fills a login on
  fields the list does not recognise.
- **23.10 Offer to save and update.** When the user sends a form with a password typed in (submit,
  a submit button or Enter), the page's private script world reports the origin, username and
  password to main as a console line encrypted with a per-tab key only main and that world hold
  (`capture.ts`); a page cannot read or forge it, and it never reaches the console log the agent
  reads. A bar under the toolbar offers Save, Never for this site and Not now, or Update when the
  saved password for that username changed; nothing when it is unchanged or the site is on the
  never list. The password stays in main memory until the answer and is wiped otherwise. Nothing
  is captured while the agent drives the tab. Secure pages only.
- **23.13 Secure password store** (`src/main/browser/passwords.ts`).
  - `~/.kucedr/browser/passwords.json`: a random store key sealed by the system keystore, and one
    AES-256-GCM ciphertext per password, bound to its entry's id, site and username.
  - Listing and matching read only sites and usernames; one password is decrypted when filled and
    wiped from memory after it is inserted (`fill.ts`).
  - Secure pages only (`https`, `localhost` for development). Exact host, or a host of the same
    registrable domain under the public suffix list (`tldts`), so `a.github.io` never matches
    `b.github.io`. The main process rechecks the tab's real address before filling.
  - A store that cannot be read is never overwritten; writes are atomic and keep the previous copy
    as `passwords.json.bak`.
  - `~/.kucedr/browser` and the pane's session folder are on the agent sandbox's protected list;
    the S3 backup skips `~/.kucedr/browser`; packaged builds switch on Electron's
    cookie-encryption fuse (not checkable in a development run).
  - The agent's `act evaluate` is refused on a tab after a password was filled there.
- **23.14 Password manager, first part** (Settings → Browser → Passwords). Search; edit site,
  username or password (the password is never shown, a new one replaces it); delete one or all.
  Every delete asks first with a native warning raised by the main process, Cancel by default, so
  the window cannot skip it (`src/main/browser/confirm.ts`). A "Never saved" list with a button to
  be asked again on a site.
- **23.15 Bookmarks, first part.** Settings → Browser → Bookmarks: search, rename, change the
  address (a duplicate is refused), delete. A star in the address field bookmarks the page on
  screen, filled when it is saved; clicking it then offers Remove or Edit. The toolbar menu shows
  the 45 newest bookmarks (native menus take at most 50 items) and "All bookmarks…".
- **23.16 Mouse back and forward in the pane.** On macOS, the buttons over the page move the tab
  (a listener in Kucedr's private script world, `buttons.ts`), and over the tab strip and toolbar
  the pane sends them to the tab while the app's own listener ignores them. The window's
  `app-command` buttons (Windows, Linux) and the macOS swipe go to the tab when the pointer is over
  the pane column (`under.ts`, `attach_route_navigation.ts`). With no earlier page nothing moves;
  elsewhere the app moves as before. The `app-command` and swipe routes are not exercised: they
  need a real pointer over the pane.

### Not implemented yet

- **23.1:** the one-time import offer when the pane first opens.
- **23.4 direct read** of another browser's live password store: not planned (it is the technique
  password-stealing malware uses); the CSV export is the path.
- **23.5 Sign-ins (cookies) import**, **23.7 the agent signing in with a saved login** and
  **23.8 the old agent profile**: waiting on the open decisions below.
- **23.11 Addresses and contact details.**
- **23.12 Form history.**
- **23.13:** the optional primary password (scrypt, unlock prompt, Touch ID, locking on idle,
  sleep and screen lock).
- **23.14:** adding a login by hand; reveal and copy behind Touch ID (clipboard cleared after 30
  seconds); export to CSV; "last used"; undo after delete; the store status line.
- **23.10:** sign-ins sent by a script-driven button that is not a submit button are not caught
  (Enter in the field still is).
- **23.15:** folders (kept on import), a toolbar menu with every bookmark (folders would let it
  show more than 45), adding folders, moving and multi-select, undo, duplicate merge, export.
- **⌘[ and ⌘] in the pane** (keyboard back and forward follow the mouse rule), see the open
  decisions.
- **Autofill drawn in a separate view** instead of in the page; see the open decisions.
- **Offer to move the exported password CSV to the bin** after an import.
- **Some sites refuse sign-in in an embedded browser**, Google among them _(not verified)_.
- **23.17–23.19** tab restore, browsing history and bookmark safety; planned in
  [Browser restore plan](../BROWSER_RESTORE.md).

### How the import works

- **No list of browsers.** The code names no browser. A profile is recognised by the files its
  engine writes (`src/main/browser/formats.ts`), so any browser built on a known engine is found,
  and its name on screen comes from its own folders (`label.ts`). Adding a format is one more
  entry in that file.
- **Import screen.** It searches the folders where applications keep their data (`roots.ts`,
  `discover.ts`) and lists every profile it finds, with what it holds, when it was last used and
  where it is. Everything is ticked, so one button imports it all. Profiles that were never used
  are left out.
- **What a file is, is worked out from its content** (`read.ts`), not its name: a database in one
  of three history and bookmark layouts, a bookmark tree or settings as JSON, or the bookmarks
  page every browser can export. The third database layout is the one Safari uses; it is tested
  against a made-up file only, and Safari's own folder is not searched because macOS guards it.
- **Bookmarks and history (23.2)**, read from a private copy, kept in
  `~/.kucedr/browser/library.json`, suggested under the address field in a dropdown sized to the
  field, with a bookmarks menu in the toolbar. History keeps the 5,000 most recent pages. When a
  profile has only the bookmark backup file (`Bookmarks.bak`) and not the live one — which happens
  while the browser is closed — the backup is read (`files.ts`), so a main profile's bookmarks are
  not missed.
- **Search from the address field (23.6)**: words search with the imported default engine, or
  DuckDuckGo until one is imported. Read from the first engine family's settings file only; the
  home page is not read.
- **Passwords from a file.** Columns are matched by what their header means
  (`src/main/browser/csv.ts`), deduped by site and username. A password is read in the main process
  and inserted straight into the field through the view's debugger; it never reaches the renderer
  or the model. The main process polls the autofill script world for the user's own focus, never
  while the agent is acting on the tab.
- **Favicons.** https and data icons are used directly; http icons are fetched in the browsing
  session and passed on as data (`create.ts`).

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 23.1 | Import screen | Settings → Browser → Import: the browsers and profiles found on the machine, a tick box per kind of data, and a summary of what came in. Offered once when the pane first opens. Can be run again without creating duplicates | No browser settings page today | S |
| 23.2 | Bookmarks and history | Bookmarks and visited pages from the other browser, suggested while typing in the address field; a small bookmarks menu | Read from the other browser's files, or from an exported bookmarks file; the address field has no suggestions today | M |
| 23.3 | Saved passwords | A password list in Kucedr, with offer-to-save and fill on the matching site, managed in Settings | Secrets sealed with the system keystore as elsewhere ([Privacy](PRIVACY.md), 1.2); no password store today | M–L |
| 23.4 | Import passwords | Passwords from the file every browser and password manager can export, then directly from the other browser where the system allows | 23.3 | S from a file; M–L direct |
| 23.5 | Import sign-ins | Sites open already signed in, without typing passwords again | Cookies copied into the pane's session; see the table below for where this is possible | M–L |
| 23.6 | Import settings | Default search engine, so words typed in the address field search; home page | Most browser settings have no counterpart in a minimal pane | S |
| 23.7 | Agent signs in with a saved login | "Sign in to this site" works when a login is saved: Kucedr fills it after the user approves, and the model never receives the password | 23.3; the outline fix above | M |
| 23.8 | Carry over the old agent profile | Logins from the earlier Chrome profile come across, then the old folder is offered for deletion | It is a Chrome-format profile, so the same reader applies; whether its logins can be decrypted is _not verified_ | S |
| 23.9 | Suggestions on the field | Clicking into a username or password field on a site with saved logins opens a list under the field; picking a name fills both fields. Arrow keys, Enter and Escape work as in other browsers | The sealed store and the fill code (`passwords.ts`, `fill.ts`); the toolbar key button stays for fields that are not recognised | M |
| 23.10 | Offer to save and update | After the user signs in by hand, the toolbar asks "Save password for this site?" with Save and Never for this site; a changed password offers an update | 23.3; a script that sees the form being sent | S–M |
| 23.11 | Addresses and contact details | Name, email, phone and postal address saved as one or more entries in Settings, suggested on fields that ask for them, filling the whole form at once | Same suggestions list as 23.9; a sealed file of its own | M |
| 23.12 | Form history | Values the user typed before into the same field on the same site are suggested while typing, and can be deleted one by one | Same suggestions list | S |
| 23.13 | Secure password store | Passwords encrypted one by one, an optional primary password, strict site matching, kept away from the agent; see [Password security](#password-security-2313-2314) | The sealed store in `passwords.ts` | M |
| 23.14 | Password manager in Settings | Search, add, edit, delete; reveal, copy and export behind Touch ID, the system password or the primary password | 23.13; app lock ([Privacy](PRIVACY.md), 1.4) | S–M |
| 23.15 | Bookmarks in Settings | Folders, search, add, rename, move, delete and export bookmarks; a star in the address field for the page on screen; see [Bookmarks in Settings](#bookmarks-in-settings-2315) | The imported bookmarks in `library.ts` | M |
| 23.16 | Mouse back and forward in the pane | The mouse's back and forward buttons, and the trackpad swipe, move the browser tab's history when the pointer is over the pane, and never the app's; see [Back and forward](#back-and-forward-2316) | The app's own back and forward handling | S |
| 23.17 | Tabs restored after a crash or quit | The pane reopens with the same tabs, order and front tab; Back still works; only the tab on screen loads; see [Browser restore plan](../BROWSER_RESTORE.md) | Tabs live only in memory today (`paneTabs` in `pane.ts`); Electron's `navigationHistory.restore` | M |
| 23.18 | Browsing history | Pages opened in the pane are recorded, suggested in the address field, and listed in Settings → Browser → History with search and delete | Only imported history exists today; it shares `library.json` with the bookmarks | M |
| 23.19 | Bookmarks that cannot be lost | A damaged file is never overwritten, the previous copy is kept, writes are flushed, clearing is split and confirmed, and bookmarks export to a standard file | `library()` falls back to empty and the next write saves that over the damaged file; Clear deletes bookmarks and history in one click | S |

## Saved data and autofill (23.9–23.12)

The pane keeps what the user types into forms (logins, addresses, contact details and earlier
entries) and offers it back in a list under the field, as other browsers do. Today a saved login
is filled only from the toolbar's key button.

### What the user sees

- **On focus.** Clicking into a recognised field opens a list under it: saved usernames on a login
  field, saved entries on an address field, earlier values on any other field. Typing narrows the
  list. Picking an entry fills every field of that kind in the same form, not only the one clicked.
- **Keyboard.** Up and Down move through the list, Enter fills, Escape closes it. The caret stays
  in the field the whole time.
- **Never a secret on screen.** The list shows usernames and entry names, never a password.
- **After a sign-in.** When a form with a password is sent, a bar under the toolbar offers to save
  it, or to update the saved one if the password changed. "Never for this site" stops the offer
  there.
- **In Settings → Browser.** Saved logins, addresses and form history, each with delete and clear
  all. Seeing a password needs the app lock or the system's own check
  ([Privacy](PRIVACY.md), 1.4).

### How a field is recognised

From the field's standard `autocomplete` hint first (`username`, `current-password`,
`new-password`, `email`, `tel`, `street-address`, `postal-code` and the others), then its type, then
words in its name, label and placeholder. This follows the import's rule of reading meaning rather
than keeping a list of sites (as `csv.ts` does for column headers).

### How it is built

- **Watching the page.** A small script runs in Kucedr's own script world on every page, as the
  agent cursor does (`src/main/agent/tools/web/browser/cursor.ts`), so the page cannot see or
  change it. It reports focus, typing and form sending to the main process through a channel that
  exists only in that world: a binding added through the view's debugger and tied to that world by
  name. The page cannot call it, so it cannot send fake reports _(to confirm in a prototype)_.
- **Drawing the list.** The page's view is drawn above Kucedr's window, so the app's own menus
  cannot appear over a field. Recommended: a small separate view of Kucedr's own, placed over the
  page just under the field. Chrome draws its autofill list outside the page for the same reason:
  the page cannot read, cover or imitate it. It hides with the page whenever an app dialog or menu
  covers the pane.
- **Filling.** The main process reads the value from the sealed store and inserts it through the
  view's debugger, as `fill.ts` does for passwords today. Values never pass through the app's
  window.
- **Storage.** One sealed file per kind beside `~/.kucedr/browser/passwords.seal`, with the same
  system keystore. Addresses and form history are personal data, so they are sealed too.

### Rules

- **Only the user's own focus opens the list.** Nothing is suggested while the agent is acting on
  the tab, and nothing is filled when a page loads: every fill follows a choice by the user.
- **Visible fields only.** A fill touches only fields the user can see in the same form. Hidden
  fields are a known way for a page to collect an address the user did not mean to give.
- **Secure pages only.** Suggestions and fills run on `https` pages and `localhost`, in the top
  page only (frames are not supported by the pane anyway).
- **Matching site.** A login is offered only on the site it was saved for; form history only on
  the site where it was typed.
- **Nothing kept without consent.** A password captured when a form is sent stays in the main
  process memory until the user picks Save, and is dropped otherwise. Fields marked
  `autocomplete="off"` are not added to form history.
- **What the model sees.** Never a password. Addresses and other filled values appear in the page
  outline like anything else in a form, so they reach the model provider once filled. Settings
  says so.
- **The agent cannot read the store.** It has no tool to list saved data. Filling a login or an
  address on its behalf goes through approval (23.7).
- **Not in private or Tor tabs**, and kept per workspace, as for imports above.

## Password security (23.13, 23.14)

Saved passwords are the most sensitive data Kucedr holds. This section sets how they are
encrypted, unlocked, matched and kept away from the agent.

### What the code does today

Updated 2026-11-20. The detail behind the password lines of [Status](#status); each item was
verified in the built app.

- **BUILT (23.13) — two layers of keys.** `~/.kucedr/browser/passwords.json`, owner-only, holds a
  random store key sealed by the system keystore (`safeStorage`) and one AES-256-GCM ciphertext per
  password. Each ciphertext is bound to its entry's id, site and username, so a password moved to
  another entry or site in the file fails to decrypt (`src/main/browser/passwords.ts`). The earlier
  single-block `passwords.seal` is not read; logins imported before this change are imported again.
- **BUILT (23.13) — names apart from secrets.** Listing and matching read only sites and usernames;
  one password is decrypted when it is filled, kept as a buffer and wiped after it is inserted
  (`fill.ts`).
- **BUILT (23.13) — strict matching.** Exact host, or another host of the same registrable domain
  under the public suffix list (`tldts`, private domains included), so `a.github.io` never matches
  `b.github.io`. Such a match is labelled "saved for accounts.example.com" in the field list and
  the toolbar menu.
- **BUILT (23.13) — previous copy kept.** Each write keeps the copy it replaces as
  `passwords.json.bak`.
- **BUILT (23.13) — pane session and backup.** The pane's session folder
  (`Partitions/agent-browser`, its cookies and storage) joins the sandbox's protected list, and the
  S3 backup script skips `~/.kucedr/browser`. Packaged builds switch on Electron's cookie-encryption
  fuse (`electron-builder.json`); this takes effect only in a packaged app.
- **Not built yet (23.13) — the primary password.** It needs an unlock prompt and locking on idle,
  sleep and screen lock, and is set from the password manager, so it lands with 23.14.
- **PARTLY BUILT (23.14) — Settings → Browser → Passwords.** A searchable list of site and
  username; edit the site, username or password (a new password replaces the old one and is
  never shown); delete one or all. Every delete asks first with a native warning from the main
  process (Cancel is the default), so the renderer cannot skip it
  (`src/main/browser/confirm.ts`). Not built yet: adding a login by hand, reveal and copy behind
  Touch ID, export, the never-saved list.
- **PARTLY BUILT (23.15) — Settings → Browser → Bookmarks.** A searchable flat list: rename,
  change the address (a duplicate is refused) or delete. Folders and the star in the address
  field are not built yet.
- **FIXED — an import can no longer wipe the store.** A store that exists but cannot be decrypted is
  reported as broken, and an import over it is refused rather than silently overwriting it
  (`load()` in `passwords.ts`).
- **FIXED — no password on plain `http`.** Matching and filling run only on `https`, and on
  `http://localhost` for development (`secure()` in `passwords.ts`); the autofill list and the
  toolbar key button do not appear on a plain `http` site.
- **FIXED — the fill rechecks the real address.** `fillLogin` compares the tab's current URL, not
  the page script's report, against the saved login and refuses a mismatch (`canFill` in
  `passwords.ts`, used in `fill.ts`).
- **FIXED — the agent cannot read the folder.** `~/.kucedr/browser` is on the sandbox's read and
  write protected list (`src/main/agent/permissions/protected.ts`), so the agent cannot read
  `library.json` (plain-text history and bookmarks) or the sealed file.
- **FIXED — writes are atomic.** The sealed store and `library.json` are written to a temporary
  file and renamed over the target (`src/main/browser/write.ts`), so a crash mid-write cannot
  corrupt them.
- **How strong the system keystore is depends on the system** _(general knowledge, to confirm)_.
  On macOS the key sits in the Keychain, and other apps must ask before reading it, fully so only
  on signed builds ([Distribution and trust](DISTRIBUTION.md), 6.1). On Windows any program
  running as the same user can decrypt it; Chrome added its own app-bound encryption for this
  reason. On Linux any program in the session can usually ask the desktop keyring for it.

### Features

| # | Feature | What the user gets | Size |
| --- | --- | --- | --- |
| 23.13 | Secure password store | Passwords encrypted one by one, decrypted only when filled or shown, filled only on the right secure site, kept away from the agent, never lost to a failed read or a crash | M |
| 23.14 | Password manager in Settings | Settings → Browser → Passwords: search, add, edit, delete, reveal and copy behind a check, a list of sites never to save, export behind a check | S–M |

### 23.13 Secure password store

- **Two layers of keys.** A random store key encrypts each password on its own with AES-256-GCM,
  which also detects tampering. The system keystore seals only that store key. Node's built-in
  crypto covers this, with no new dependency.
- **Names apart from secrets.** Sites and usernames are kept in an index that is used for
  listing and matching, so the list under a field never decrypts a password. A single password is
  decrypted when it is filled or revealed, and nothing else.
- **Optional primary password.** A password chosen by the user, stretched with scrypt (also built
  into Node), wraps the store key. With it set the store starts locked and opens on first use;
  on macOS later unlocks can use Touch ID. It locks again after idle time, when the screen locks
  and when the computer sleeps. Recommended: offered to everyone, and suggested strongly on
  Windows and Linux, where the system keystore alone does not stop another program run by the
  same user.
- **Never lose the store.** A store that cannot be decrypted is reported, never treated as empty
  or overwritten. Writes go to a temporary file that then replaces the old one, and the previous
  copy is kept.
- **Strict matching.**
  - Secure pages only: `https`, and `localhost` for development. Never on `http`.
  - Exact host by default. Related subdomains are matched within the same registrable domain using
    the public suffix list, so `a.github.io` never matches `b.github.io`. Such a match is labelled
    "saved for accounts.example.com" in the list.
  - The main process rechecks the tab's real address just before filling, and does not rely on
    what the page script reported.
- **Away from the agent.** `~/.kucedr/browser` and the pane's own session folder join the
  sandbox's protected list for reading and writing. The agent has no tool that lists or reads
  saved logins. The existing block on `act evaluate` after a fill stays, and the agent filling a
  login goes through approval (23.7).
- **Short life in memory.** A decrypted password is kept as a buffer and wiped after it is
  inserted. It is never logged and never written to a chat's run record.
- **Sign-ins encrypted too.** Electron's cookie-encryption option is switched on, so cookies the
  pane keeps are encrypted on disk like Chrome's.
- **Leaves the machine only encrypted.** Passwords are left out of cloud backup until backup is
  encrypted end to end ([Privacy](PRIVACY.md), 1.5). They are then sent still encrypted with the
  store key, which never leaves the machine.

### 23.14 Password manager in Settings

- **The list.** Site, username and when the login was last used, with search. Passwords show as
  dots.
- **Changes.** Add a login by hand, edit its username, password or site, and delete it with undo.
- **Reveal and copy behind a check.** Showing or copying a password asks for Touch ID or the
  system password on macOS, and for the primary password or app lock elsewhere
  ([Privacy](PRIVACY.md), 1.4). A copied password is cleared from the clipboard after 30 seconds.
- **Never saved.** The sites where "Never for this site" was chosen (23.10), with a remove button.
- **Export.** The standard CSV that other browsers import, behind the same check and a warning
  that the file is plain text.
- **Status.** Whether the primary password is set, when the store locks, and which system
  keystore protects it.
- **Built with the app's own components** (list, dialog, input, switch), like the rest of
  Settings.

## Bookmarks in Settings (23.15)

### What exists today

Updated 2026-11-20. Bookmarks are kept as a flat list of address and title in
`~/.kucedr/browser/library.json` (`src/main/browser/library.ts`), so the folders of an imported
browser are lost. Settings → Browser → Bookmarks lists them with search, and renames, changes the
address of or deletes one. The star button in the pane's toolbar opens a menu of the first 60
bookmarks. There is no way yet to bookmark the page on screen, to add a folder, or to move a
bookmark.

### What the user gets

- **Settings → Browser → Bookmarks.** Bookmarks shown as a tree of folders, with search. Add a
  bookmark or folder, rename, change an address, delete with undo, and move by dragging or with
  the keyboard ([Accessibility](ACCESSIBILITY.md), 4.2). Selecting several moves or deletes them
  together. Opening one shows it in the browser pane.
- **From the pane.** A star in the address field bookmarks the page on screen, filled in when the
  page is already saved; clicking it again edits the name and folder or removes it. The toolbar's
  bookmarks menu shows the folders and is no longer cut off at 60.
- **Folders kept on import.** The import keeps the other browser's folder tree, and a second
  import adds only what is new.
- **Duplicates.** The same address saved twice is pointed out, with a merge button.
- **Export.** The standard bookmarks file every browser can import, so the user is never locked
  in.

### How it is built

- **Data.** Each bookmark gets an id, a parent folder and a position, instead of the flat list. A
  saved flat list is read as one folder when the app first loads it, with no migration script.
- **Storage.** Bookmarks stay on the machine with the rest of the browser data. They come under
  the agent sandbox's protection with the password store (23.13), and under encrypted data at
  rest once that exists ([Privacy](PRIVACY.md), 1.3).
- **The agent.** No bookmark tool in the first version. Reading or adding bookmarks for the user
  is a later decision.

## Back and forward (23.16)

### What happens today

Built 2026-11-20; see [Status](#status).

- **Over the page (macOS).** A listener in Kucedr's private script world on each page catches
  the back and forward buttons and moves the tab's history
  (`src/main/agent/tools/web/browser/buttons.ts`). Checked in the built app.
- **Over the tab strip and toolbar (macOS).** The pane sends the buttons to its tab, and the app's
  listener (`src/renderer/src/hooks/mouse.ts`) ignores presses inside the pane. Checked in the
  built app.
- **Window-wide events.** The window's `app-command` buttons (Windows, Linux) and the macOS swipe
  go to the tab shown in the pane when the pointer is over the pane column, otherwise to the app
  (`under.ts`, `src/main/attach_route_navigation.ts`). Not exercised yet: it needs a real pointer
  over the pane, and Windows and Linux.
- **Rough edge.** The pane column is taken as the full-height strip above and including the page
  view; if the pane's layout changes, the renderer should pass the pane's own rectangle instead.

### What the user gets

- **Pointer over the pane means the browser.** With the pointer anywhere over the pane (the page,
  the toolbar or the tab strip), the mouse's back and forward buttons and the trackpad swipe go
  back and forward in the active tab, as in any browser. The app does not change screen.
- **Nothing falls through.** When the tab has no earlier or later page, nothing happens. The app
  does not move instead.
- **Pointer elsewhere means the app**, as today.
- **Pane hidden or covered.** When the pane is closed, or an app dialog or menu covers it and the
  page is hidden, the buttons go to the app.
- **While the agent works.** The user can still go back. The agent sees the new page on its next
  look at the page, as with any other input from the user.

### How it is built

- **Where the pointer is decides, in the main process.** The main process already places the
  pane's view, so it knows the pane's rectangle in the window. For window-wide events (the
  `app-command` buttons and the swipe) it compares the pointer's position with that rectangle and
  sends the event to the active tab or to the app.
- **The page view's own clicks.** On macOS the button press goes to the page's view. The script
  Kucedr already runs in its own script world on each page (as `autofill.ts` does) reports the back
  and forward buttons to the main process. Which Electron event carries these buttons from a view
  is to confirm in a prototype.
- **The toolbar and tab strip.** The app's listener ignores presses inside the pane's area and
  sends them to the tab instead, through the same back and forward commands the toolbar buttons
  use (`src/main/agent/tools/web/browser/command.ts`).
- **One place for the rule.** The three routes (app page, window events and page view) call one
  function that picks the tab or the app, so they cannot disagree.

### Check

On macOS, Windows and Linux:

- Open two pages in a tab and press the mouse's back button with the pointer over the page. The
  tab goes back and the app stays on Home.
- Repeat over the toolbar, then with a swipe on macOS.
- Press back with the pointer over the chat. The app goes back as today.
- On a tab with no history, press back over the page. Nothing moves.

## What each browser allows

From general knowledge of these browsers, not checked against current versions. The first step of
a detailed plan is to confirm each cell on macOS, Windows and Linux.

| Source | Bookmarks and history | Passwords | Sign-ins (cookies) |
| --- | --- | --- | --- |
| Chrome, Edge, Brave, Vivaldi, Opera, Arc (one shared format) | Plain files in the profile folder; history is copied first because the browser locks it while running | Exported file always. Direct read: on macOS the system asks the user to let Kucedr use that browser's keychain entry; on Linux through the desktop keyring; on Windows recent versions tie the key to the browser itself, which blocks other apps | Same protection as passwords, so possible on macOS and Linux and likely blocked on Windows |
| Firefox | One database in the profile folder | Exported file always. Direct read needs Firefox's own encryption format handled, and the user's primary password if one is set | Stored unprotected in the profile, so the easiest source |
| Safari (macOS) | Readable only after the user grants Kucedr Full Disk Access in System Settings | Exported file only; they live in Apple's Passwords app | Not planned: protected storage, and the same Full Disk Access |
| Password managers (1Password, Bitwarden and others) | — | Exported file | — |

No new dependency is expected: the databases can be read with the built-in SQLite the knowledge
store already uses (`src/main/agent/knowledge/rag/sqlite.ts`), and decryption uses Node's own
crypto. Extensions, open tabs and payment cards are not imported.

## Rules the design keeps

- **Only the user starts an import.** There is no agent tool for it, and the agent cannot reach the
  import code or the other browser's files through it.
- **Read only.** Kucedr works on a copy and never writes to another browser's profile.
- **Stays on the machine.** Nothing imported is uploaded. Imported passwords and sign-ins are left
  out of cloud backup until backup is encrypted ([Privacy](PRIVACY.md), 1.5).
- **Sealed at rest.** Passwords are sealed like other secrets (1.2), and seeing one in Settings
  needs the app lock or the system's own check (1.4). Cookie encryption is switched on for the
  pane's session before sign-ins are imported.
- **The model never receives a password.** The page outline leaves out password field values, and
  a saved password is filled by Kucedr, not typed by the agent. A saved password is filled only on
  the site it was saved for.
- **Say what the system will ask.** Before a macOS keychain or Full Disk Access prompt appears,
  the import screen explains why and names the browser.
- **Not in private or Tor tabs.** Imported data is never available there
  ([Private and VPN browsing](VPN.md), [Tor](TOR.md)).
- **One workspace.** An import goes into the workspace it was started from
  ([Multiple workspaces](WORKSPACES.md)).
- **Removable.** Imported data can be cleared, by kind, from storage management (1.7).

## Open decisions

- **Order.** Recommended: first the file-based imports (bookmarks file, password file) with the
  password list (23.3), because they work for every browser on every system with no system
  prompts. Then sign-ins (23.5) from Firefox and, on macOS, from Chrome-family browsers. Direct
  password reading last, if the exported file proves too awkward.
- **Sign-ins are the most useful and the most sensitive.** Copying another browser's cookies is
  the same technique password-stealing malware uses, which is why Windows now blocks it for Chrome
  and why macOS asks the user. Recommended: build it only for the systems that allow it with the
  user's consent, do not work around the Windows block, and expect some sites to end an imported
  session anyway.
- **The agent and saved passwords (23.7).** Recommended: allowed, with an approval per site the
  first time, filled by Kucedr. One gap to close in the detailed plan: once a password is in a
  page, a script the agent runs there (`act evaluate`) can read it, so that action needs an
  approval or a block on pages where a password was filled.
- **Whether Kucedr keeps passwords at all.** Recommended: a small list with save and fill, nothing
  more (no generator, no sharing, no breach checks). The alternative is to import sign-ins only
  and leave passwords in the user's own manager.
- **The exported password file is plain text.** Recommended: after a successful import Kucedr
  offers to move it to the bin.
- **One-time import or keep in step.** Recommended: one-time, run again when wanted. Continuous
  sync with another browser is not planned.
- **Workspaces first.** Decide how much a workspace separates (10) before passwords and sign-ins
  are stored, so they do not have to be split afterwards.
- **Where the suggestions list is drawn.** Recommended: a separate small view, as above. The
  simpler alternative is to draw it inside the page in a closed shadow root, as the agent cursor
  is drawn; it needs no new view, but a page can cover it or show a fake one in its place.
- **Order within autofill.** Recommended: 23.9 then 23.10, since they complete the password list
  already built; addresses (23.11) next; form history (23.12) last.
- **Form history on or off.** Recommended: logins and addresses on by default; form history off
  by default with a switch, because it keeps everything typed into any field, search boxes
  included.
- **Payment cards.** Recommended: not planned. Card numbers bring compliance and fraud weight, and
  the system's own wallet or the user's password manager already holds them.
- **Password generator on sign-up forms.** Not planned, in line with keeping the password list
  small.
- **Order for passwords.** Recommended: first the four small fixes from
  [What the code does today](#what-the-code-does-today): never overwrite a store that cannot be
  read, no fill on `http`, recheck the address before filling, and protect `~/.kucedr/browser`
  from the agent. They close real gaps in what is already built. The two-layer store (23.13) and
  the password manager (23.14) come next, then offer-to-save (23.10).
- **Primary password.** Recommended: optional, with the warning that a forgotten primary password
  cannot be recovered and the saved passwords are lost. Making it required would protect Windows
  and Linux users fully, but adds a step most people skip in other browsers.
- **Windows Hello for reveal and copy.** Electron offers Touch ID on macOS only; Windows Hello
  needs a native module, which is a new dependency. Recommended: the primary password on Windows
  for now.
- **Bookmarks bar.** A row of bookmarks under the toolbar. Recommended: not now, because the pane is
  meant to stay minimal; the menu and the star cover the common cases.
- **Keyboard back and forward.** ⌘[ and ⌘] (and Alt+Left and Alt+Right on Windows and Linux)
  move the app's screens today. Recommended: they go to the tab when the page has keyboard focus,
  following the same rule as the mouse, since these are the browser's own keys. They stay with the
  app when focus is in the chat.
