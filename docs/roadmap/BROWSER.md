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
