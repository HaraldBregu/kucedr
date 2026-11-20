# 23. Browser import

Part of the [Roadmap](README.md). Status: proposal.

The browser pane can bring in what the user already has in Chrome, Firefox and other browsers:
bookmarks, history, saved passwords, signed-in sessions and the few settings that apply. The user
does not start again from an empty browser.

## What exists today

- **The pane is built** ([Embedded agent browser plan](../AGENT_BROWSER_PLAN.md)). Every tab is a
  web view in one permanent session, `persist:agent-browser`
  (`src/main/agent/tools/web/browser/create.ts`).
- **Nothing to import into.** The pane has no bookmarks, no history list, no saved passwords, no
  autofill and no settings of its own. The address field accepts addresses only, not search words
  (`src/main/agent/tools/web/browser/command.ts`).
- **Sign-ins are done by hand** in the pane and kept as cookies in that session. Electron stores
  them unencrypted on disk unless its cookie-encryption option is switched on, and the project does
  not switch it on _(from Electron's documentation; not checked in the running app)_.
- **Some sites refuse sign-in in an embedded browser**, Google among them. Bringing over an
  existing session may get round that _(not verified)_.
- **The earlier Chrome profile** (`~/.kucedr/agent-browser`) is still on disk and its logins were
  not carried over.
- **Password values are kept out of the page outline** (`src/main/agent/tools/web/browser/snapshot.ts`).
  A script the agent runs in the page (`act evaluate`) can still read a field, which matters once
  passwords are filled automatically (see the open decisions).

## Built so far

- **No list of browsers.** The code names no browser. A profile is recognised by the files its
  engine writes (`src/main/browser/formats.ts`), so any browser built on a known engine is found,
  and its name on screen comes from its own folders (`label.ts`). Adding a format is one more
  entry in that file.
- **Import screen (23.1)** at Settings → Browser. It searches the folders where applications keep
  their data (`roots.ts`, `discover.ts`) and lists every profile it finds, with what it holds,
  when it was last used and where it is. Everything is ticked, so one button imports it all.
  Profiles that were never used are left out. A second button takes any file or folder: a
  browser's folder, one profile, or exported files. Running an import again adds no duplicates.
  Not built: the one-time offer when the pane first opens.
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
- **Passwords from a file (23.3 + 23.4, file path)**. The user exports a password CSV from the
  other browser and chooses it in Settings → Browser. Columns are matched by what their header
  means (`src/main/browser/csv.ts`), so any browser's or password manager's export works, with no
  product list. The logins are sealed with the system keystore (`safeStorage`, via
  `src/main/browser/passwords.ts`) in `~/.kucedr/browser/passwords.seal`, deduped by site and
  username, and can be deleted. The direct read of another browser's live password store is **not
  built** and is not planned here: it needs the browser's key out of the OS keychain and is the
  technique infostealers use, so the file export is the path. A key button in the pane toolbar
  fills a saved login whose site matches the current page; with more than one match the user
  picks. The password is read in the main process and inserted straight into the field through the
  view's debugger — it never reaches the renderer or the model. **Not built:** offer-to-save after
  a manual sign-in, viewing a saved password, and editing the list.
- **Autofill on a field (23.9, logins).** Clicking into a username or password field on a site
  with a saved login opens a list under the field with the saved usernames; Up/Down move, Enter
  fills both the username and the password, Escape closes it. A saved login is offered on its own
  host and on sibling subdomains of the same site (`matchLogins` in `passwords.ts`). The list is
  drawn in a closed shadow root in a private script world the page cannot reach
  (`autofill.ts`), the main process polls that world for the user's own focus (never while the
  agent is acting), supplies the usernames and does the fill, so the page never sees the list and
  a password never reaches the renderer or the model. A choice counts only from a real key or
  click. **Not built:** addresses and contact details (23.11), form history (23.12), offer-to-save
  after a manual sign-in (23.10), and drawing the list in a separate view rather than in the page.
- **The `act evaluate` hole is closed for filled pages.** Once a password is filled on a tab, the
  agent's `act evaluate` is refused on that tab until it navigates away (`act.ts`), so a script the
  agent runs cannot read the filled value. The outline already omits password-field values.
- **Favicons and a draggable toolbar.** Tabs show the site's favicon (https and data icons
  directly, http icons fetched in the browsing session and passed on as data, `create.ts`). The
  tab strip and toolbar are window-drag regions, so the pane's top can move the window and
  double-click zooms it, as the chat side does.
- **Checked on macOS only.** The search of Windows and Linux data folders, and the keystore seal,
  are written but have been exercised on macOS only.
- Sign-ins (23.5), the agent signing in on its own (23.7) and the old profile (23.8) are not built;
  they wait on the open decisions below.

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
