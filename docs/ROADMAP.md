# Roadmap

Status: proposal, written 2026-11-19. Nothing here is implemented. Each feature gets its own
detailed plan before any implementation starts.

This document lists the features proposed for Kucedr by area: what the user gets, what already
exists to build on, a rough size, and the decisions still open. Statements about current behaviour
come from a read of the checkout on the date above; items marked _(not verified)_ or _(not
measured)_ were read from code or docs and not confirmed in the running app.

Size is a rough guide: **S** a few days, **M** one to two weeks, **L** more than that or dependent
on an outside decision.

## Recommended order

1. **Privacy: Privacy centre, sealed credentials, encrypted data** (1.1–1.4). Chats, memory and
   model API keys sit unencrypted on disk today.
2. **Agent efficiency: automatic compaction and run insights** (2.1–2.2). Measured rounds show
   turn count and prompt size are the remaining levers, and the user cannot see either.
3. **Accessibility: screen-reader chat and full keyboard use** (4.1–4.2). A screen-reader user
   cannot follow a streamed reply today.
4. **User experience: completion notifications and search across chats** (3.1–3.2).

The user-experience group was chosen to be planned in detail first; see
[User experience in detail](#user-experience-in-detail). The browser pane (3.9) comes before the
Tor and VPN features (11, 12), which live inside it.

## 1. Privacy

| #   | Feature                         | What the user gets                                                                                                                                             | Builds on                                                                                                                                                                         | Size |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1.1 | Privacy centre                  | One Settings page: what is stored and how much, what leaves the machine and to whom, delete all chats, export everything, retention periods for chats and logs | `src/main/data/data_controller.ts` already handles memory, knowledge and a `sessions` scope no page shows; an unused `privacy` translation key exists                             | M    |
| 1.2 | Sealed credentials              | Every key (model, database, search) protected by the OS keychain, shown masked in Settings, revealed one at a time                                             | S3 and connector tokens already do this (`src/main/shared/safe_storage.ts`, `src/main/mcp/mcp_record_seal.ts`); model keys in `src/main/providers/providers_store.ts` do not      | S    |
| 1.3 | Encrypted data at rest          | A switch that encrypts chats, memory, attachments and health notes on disk with a key held in the OS keychain; export still produces readable files            | Node's built-in crypto; folder layout in `src/main/shared/user_data_location.ts`                                                                                                  | L    |
| 1.4 | App lock                        | Touch ID, Windows Hello or a passphrase to open the app or after idle                                                                                          | Electron's native biometric prompt on macOS; pairs with 1.3                                                                                                                       | S–M  |
| 1.5 | Encrypted backup                | Backups encrypted with a passphrase before upload, so the bucket owner cannot read them                                                                        | `resources/plugins/bootstrap/scripts/backup-s3` uploads unencrypted today                                                                                                         | M    |
| 1.6 | Private chat                    | A chat that is never written to disk and never feeds memory                                                                                                    | Session persistence in `src/main/agent/session`; a memory toggle already exists                                                                                                   | M    |
| 1.7 | Storage management              | Storage use per area with clean-up, automatic retention, owner-only folders                                                                                    | On the surveyed machine logs were 172 MB against 43 MB of chats; the chats, memory and logs folders are readable by other local accounts while `providers/` is owner-only         | S    |
| 1.8 | Account and cloud data deletion | Delete the account and everything held on the server from inside the app                                                                                       | Sign-out only today; needs a server function                                                                                                                                      | M    |

**Open decisions**

- **1.3 changes how the data folder behaves.** Files stop being readable by other tools, including
  the run-trace analysis used for agent speed and plain-file backup. Recommended as opt-in, off by
  default.
- **1.3 and 1.4 protect fully only on signed builds** (see 6.1). On unsigned builds another local
  process can ask the keychain for the same key ([Security audit](SECURITY_AUDIT.md) #18).
- **1.5 before any device sync.** Sync code exists but is not wired in
  ([Cloud file synchronization design](STORAGE_SYNC.md)); if it ships later it should reuse the same
  passphrase scheme (8.3).

**Documentation to correct alongside:** `SECURITY.md` and [CLOUD.md](CLOUD.md) describe
version-history sync and cloud chat records as live, but only tests call them.
[Settings](ui/SETTINGS.md) says data Purge has no confirmation; `src/main/ipc/data.ts` shows a
native one.

## 2. Performance and agent efficiency

Agent-turn speed has five measured rounds in [AGENT_TURN.md](AGENT_TURN.md). The model call
dominates, so the features that matter reduce turns and prompt size, then make the app feel instant
around the model. The renderer and startup have not been measured yet; 2.7 comes first for those.

| #   | Feature                   | What the user gets                                                                                           | Builds on                                                                                                                                              | Size |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 2.1 | Automatic compaction      | Long chats stay fast and cheap without pressing Compact; a visible marker shows where history was summarised | Manual compaction with its own model (`src/main/agent/compaction/compact.ts`); trimming when the context is full                                       | M    |
| 2.2 | Run insights              | Per reply: time to first token, turns, tokens, cache hits and cost, with a timeline of model and tool steps  | `run.jsonl` already records all of this per session; `src/renderer/src/pages/home/Usage.tsx` shows tokens only                                         | M    |
| 2.3 | Run budgets               | A limit on turns or tokens per run, with a warning and a pause before the limit                              | Turn and token counts already in the run events                                                                                                        | S    |
| 2.4 | Lighter first message     | Faster first reply in a new chat by loading memory summaries on demand instead of always                     | First call is 10.6K tokens against a 9K target; memory summaries are 5.7 KB of it ([AGENT_TURN.md](AGENT_TURN.md), round 5)                            | S–M  |
| 2.5 | Smooth streaming          | Replies stream without stutter in long chats                                                                 | Each token appears to re-render the whole chat and crosses to the window one at a time _(read from code, not measured)_                                | M    |
| 2.6 | Instant start and sidebar | Window appears before background services start; the chat list updates on change                             | 1.29 s from services ready to window shown on the surveyed machine; `src/renderer/src/pages/home/Sidebar.tsx` re-reads every chat from disk every 1.5 s | M    |
| 2.7 | Performance check         | A repeatable measurement of start time, streaming smoothness and bundle size, run before each release        | Startup lines in the daily log, the memory monitor in `src/main/shared/metrics.ts`, the Playwright smoke spec                                          | S    |

**Open decision:** 2.4 changes what the agent knows at the start of a chat. It is a product choice,
already noted as open in round 5.

## 3. User experience

| #   | Feature                    | What the user gets                                                                                                                       | Builds on                                                                                                           | Size |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---- |
| 3.1 | Completion notifications   | A system notification and dock badge when a background run, task or approval needs attention                                             | Sounds and a shimmering title only today; no notifications anywhere                                                 | S    |
| 3.2 | Search across chats        | Find any message in any chat from one search box                                                                                         | `src/renderer/src/pages/home/Search.tsx` searches the open chat only                                                | M    |
| 3.3 | Regenerate and retry       | Re-run a reply, or retry a failed one, from the message                                                                                  | Edit and stop exist                                                                                                 | S    |
| 3.4 | Complete the "/" menu      | Skills and task commands appear in the menu that already opens on `/`                                                                    | `PromptSlash` lists modes, apps, settings pages and themes; skills and task commands are typed from memory          | S    |
| 3.5 | Shortcut guide             | One screen listing every shortcut, fed by a single list                                                                                  | Shortcuts are defined in four places; three of them do nothing today                                                | M    |
| 3.6 | Offline and failure states | A clear message and a retry when offline, when a chat fails to load, or when a rename fails                                              | No online check anywhere                                                                                            | S    |
| 3.7 | Undo and archive view      | Undo after delete or archive; a place to see archived chats _(whether one exists is not verified)_                                       | Pin, archive and categories exist                                                                                   | S    |
| 3.8 | Attachment checks          | A warning before sending a file the model cannot read or that is too large                                                               | Listed as missing in [FEATURES.md](FEATURES.md)                                                                     | S    |
| 3.9 | Browser pane               | When the agent uses the browser tool, the page appears in a resizable pane on the right of the chat instead of a separate Chrome window | [Embedded agent browser plan](AGENT_BROWSER_PLAN.md), which holds the behaviour and the comparison of approaches    | L    |

Already planned in its own doc and left there: the terminal panel ([TERMINAL.md](TERMINAL.md)).

### User experience in detail

Suggested order: 3.1, 3.3, 3.4, 3.2, 3.5, with the browser pane prototype (3.9) alongside because
it is the largest.

**3.1 Completion notifications**

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

**3.2 Search across chats**

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

**3.3 Regenerate and retry**

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

**3.4 Complete the "/" menu**

- _Behaviour._ Skills (turn on, turn off) and the task commands appear in the existing menu with a
  one-line description each.
- _Builds on._ `PromptSlash` in `src/renderer/src/components/prompt-slash.tsx`, the skills list
  exposed by `src/preload/skills.ts`, and the task commands in
  `src/renderer/src/pages/home/hooks/commands.ts`.
- _Check._ Typing `/` lists every command the composer accepts; choosing a skill enables it for the
  chat.

**3.5 Shortcut guide**

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

## 4. Accessibility

| #   | Feature                     | What the user gets                                                                                     | Builds on                                                                                                                                                 | Size |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 4.1 | Screen-reader chat          | One announcement when a reply completes or fails, tool activity read as steps, no token-by-token noise | The chat is a live log (`src/renderer/src/components/ui/chat-container.tsx`), so every chunk is announced; tool activity has no labels                    | M    |
| 4.2 | Full keyboard use           | Every action reachable without a mouse, including moving chats between categories; a skip link         | The command menu exists; drag-and-drop has no keyboard path _(not verified end to end)_                                                                   | M    |
| 4.3 | High-contrast and text size | A high-contrast theme, support for the system's high-contrast setting, and no text under 12px          | Zoom and reduced-motion support exist; about 66 places use 9–11px text; the focus ring looks under the 3:1 minimum _(from colour values, not measured)_   | M    |
| 4.4 | Named controls              | Every button and control has a spoken name                                                             | About 16 icon buttons have none, starting with onboarding and cloud settings                                                                              | S    |
| 4.5 | Accessibility checks        | New screens are checked automatically for the problems above                                           | No accessibility lint or test today; needs two development dependencies                                                                                   | S    |

## 5. Reliability and updates

| #   | Feature                  | What the user gets                                                                                                                                            | Size |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 5.1 | Stable and beta channels | Stable updates by default, beta as a choice, and update checks can be switched off (`src/main/updater.ts` gives everyone prereleases today)                  | S    |
| 5.2 | Crash recovery           | The window reloads itself after a crash and offers to resume an interrupted run _(resume behaviour today is not verified)_                                   | M    |

A crash-reporting service is left out on purpose: the app sends no telemetry today, and that is
worth keeping.

## 6. Distribution and trust

| #   | Feature                     | What the user gets                                                                                                                                              | Size                       |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 6.1 | Signed and notarised builds | No Gatekeeper or SmartScreen warning at install; unlocks the remaining hardening items in the [Security audit](SECURITY_AUDIT.md)                               | L, needs paid certificates |
| 6.2 | Website and user docs       | A landing page and help site (`package.json` references a `website` folder that does not exist; [LANDING_PAGE.md](LANDING_PAGE.md) is the brief)                | L                          |

`electron-builder.json` has `notarize: false` and `forceCodeSigning: false`;
[FEATURES.md](FEATURES.md) still describes a signed installer.

## 7. Languages

| #   | Feature          | What the user gets                                                                                               | Size           |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| 7.1 | Complete Italian | No mixed-language screens; about 200 strings are hard-coded English, including onboarding and Home               | M              |
| 7.2 | More languages   | A third language and a documented way to add one                                                                 | M per language |

## 8. Cost, plugins, sync

| #   | Feature                       | What the user gets                                                               | Size                               |
| --- | ----------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| 8.1 | Spend tracking                | Cost per provider and per chat over time, with prices read from plugin manifests | M, shares data with 2.2            |
| 8.2 | Plugin catalogue              | Browse, install with a confirmation, and update plugins                          | L, wait for outside plugin authors |
| 8.3 | Encrypted sync across devices | Chats and settings on a second device, readable only by the user                 | L, after 1.5                       |

## 9. Payments and paid services

A way to sell services from inside the app, starting with storage.

**What exists today:** nothing for billing. Accounts run on Supabase
(`src/main/cloud/supabase/auth.ts`, the `profiles` table). Storage is bring-your-own: the user
supplies their own S3 bucket and keys ([CLOUD.md](CLOUD.md)). The `kucedr://` link scheme is already
registered for sign-in (`src/main/index.ts`), and four server functions already hand out narrow
upload and download grants (`supabase/functions/storage-*`).

**What has to exist before there is something to sell:** a storage service Kucedr itself hosts.
Today there is no hosted product, only the user's own bucket.

| #   | Feature               | What the user gets                                                                                                                                         | Builds on                                                                             | Size   |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| 9.1 | Kucedr Storage        | Backup and sync that work after sign-in, with no bucket or keys to configure                                                                               | The existing grant functions pointed at a bucket the distributor owns; per-user quota | L      |
| 9.2 | Plans and checkout    | A Plans page in Settings; "Upgrade" opens the payment provider's hosted checkout in the system browser and returns to the app through a `kucedr://` link   | Existing account, deep link, Settings → Cloud                                         | M      |
| 9.3 | Entitlements          | The app knows what the account has paid for (plan, storage limit, renewal date) and unlocks it; works offline from the last known state                    | One server table written only by the payment provider's webhook                       | M      |
| 9.4 | Manage subscription   | Change plan, update card, cancel, download invoices, all on the provider's hosted portal                                                                   | Provider portal link; no billing screens to build                                     | S      |
| 9.5 | Further paid services | Hosted AI access (use the app without bringing a model key), hosted search, larger limits                                                                  | Same entitlements; each is its own product                                            | L each |

**How it fits together**

- The payment provider's secret keys live only in server functions. The desktop app is open source
  and never holds them, and never sees card details.
- Flow: the app asks a server function for a checkout link for the signed-in account; the user pays
  in the browser; the provider calls a webhook function; the webhook updates the entitlements table;
  the app refreshes entitlements when the `kucedr://` link returns and at each launch.
- The server, not the app, enforces limits (the upload grant function checks quota), because the
  app can be modified by anyone.

**Kept out on purpose:** custom card forms, invoice screens, coupons, team billing, usage-based
metering. The provider's hosted checkout and portal cover the first four; metering waits for a
service that needs it.

**Open decisions**

- **Which provider.** Recommended: a merchant of record (Paddle or Lemon Squeezy), which is the
  legal seller and handles VAT and sales tax in every country. Stripe is the alternative; it gives
  more control, but tax registration and remittance stay with the seller. This is a business and tax
  choice; check current terms and fees before settling.
- **What is sold first.** Recommended: one storage plan with one price, to prove the flow.
- **Encrypted backup (1.5) before hosted storage.** Once Kucedr holds user files, "we cannot read
  them" is the selling point and the protection.
- **Paperwork.** Terms of service, a privacy policy and a refund policy are needed before the first
  sale. [LANDING_PAGE.md](LANDING_PAGE.md) currently forbids a pricing section.
- **Server changes.** This needs new server functions and a database migration.
- The app is not in the Mac App Store, so Apple's in-app purchase rules do not apply. They would if
  it is ever listed there.

## 10. Multiple workspaces

Several named workspaces, for example one for work and one for personal use, with a switcher.

**What exists today:** one fixed workspace at `~/.kucedr/workspace`
(`src/main/shared/agent_location.ts`). [Multiple workspaces plan](WORKSPACES.md) already covers the
registry, generated folder names, rename without moving files, images, the switcher in the
Workspace sidebar, switching by relaunching the app, permission clean-up on switch, and backup.

**The gap between that plan and "work and personal":** it separates files only. Chats, memory,
settings, providers, skills and Library stay shared, and its limitations section says this is not
suitable for keeping confidential client work apart. Its first open question is whether each
workspace should also have its own chats and memory.

| #    | Feature                   | What the user gets                                                                                                          | Builds on                                                                                                 | Size |
| ---- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---- |
| 10.1 | Workspaces and switcher   | Create, name, picture and switch workspaces; each has its own files                                                         | [WORKSPACES.md](WORKSPACES.md) as written                                                                 | M    |
| 10.2 | Separate chats and memory | Each workspace has its own chat list and its own memory, so what the agent learns at work never appears in a personal chat  | Chats live in `~/.kucedr/sessions`, memory in `~/.kucedr/memory`; both become per workspace               | M    |
| 10.3 | Separate sign-ins         | Each workspace has its own browser logins and its own connected accounts (work mail and calendar apart from personal)       | The agent's browser profile (`~/.kucedr/agent-browser`) and connector tokens are single and shared today  | M–L  |
| 10.4 | Per-workspace defaults    | A default model and instructions per workspace; keys, plugins, skills and app settings stay shared                          | Model slots in Settings                                                                                   | S    |
| 10.5 | Delete and move           | Delete a workspace with its data; move a chat to another workspace                                                          | Left out of the existing plan                                                                             | S    |

**Open decisions**

- **How much a workspace separates.** Recommended: 10.1 and 10.2 together as the first version. For
  "work and personal", shared chats and memory is the part that would surprise people. Deciding
  before implementation matters: the existing plan notes that separating them later changes where
  chats and memory are stored, and existing data would need a home. Existing chats and memory would
  stay with the first workspace. [WORKSPACES.md](WORKSPACES.md) is updated once this is decided.
- **10.3 with the browser pane.** If the browser pane (3.9) is built first, its saved logins should
  be designed per workspace from the start.
- **Shared on purpose:** model keys, plugins, skills, app settings, the account and anything paid
  for (section 9).

**Touches other features:** search across chats (3.2) searches the active workspace; notifications
(3.1) name the workspace; encryption (1.3) and backup (1.5) cover every workspace; storage limits
(9.1) count all workspaces together.

## 11. Tor and .onion sites

The agent's browser can open `.onion` addresses, shown in the browser pane like any other page.

**What exists today:** nothing. The browser tool starts the user's installed Google Chrome with a
direct connection (`src/main/agent/tools/web/use_web_browser.ts`); there is no proxy or Tor handling
anywhere in `src/main`.

**What "Tor Browser integration" can mean here.** Tor Browser itself cannot be driven by the agent:
the tool controls Chrome through Playwright, and Playwright does not support Tor Browser. What works
is sending the agent's own browser through the Tor network, which is what reaches `.onion` sites.

| #    | Feature                   | What the user gets                                                                                                                                   | Builds on                                                                     | Size |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- |
| 11.1 | Tor tabs                  | `.onion` addresses open in a tab that connects through Tor, marked with a Tor indicator in the pane's toolbar                                        | Browser pane (3.9); a second browser instance started with a Tor connection   | M    |
| 11.2 | Tor connection            | Kucedr finds Tor already running on the machine (Tor Browser or the Tor service) and shows its status in Settings; an address field for a custom setup | Nothing to bundle                                                             | S    |
| 11.3 | Open any site through Tor | A per-tab choice to load an ordinary site through Tor, for the user or when the user asks the agent to                                               | 11.1                                                                          | S    |
| 11.4 | Built-in Tor              | Tor ships inside Kucedr and starts on demand, so nothing has to be installed                                                                         | Adds a program to ship, sign and keep updated on three platforms              | L    |

**Rules the design keeps**

- **Separate and disposable.** Tor tabs use their own profile, never the one holding the user's
  logins, and it is wiped when the Tor session ends.
- **No fallback.** If Tor is not running or drops, a Tor tab fails. It never retries over the normal
  connection. Address lookups also go through Tor.
- **Downloads off** in Tor tabs.
- **Approval.** The first time a chat opens a Tor tab, the user approves it; existing tool approvals
  still apply.
- **Interactive only.** Background and scheduled runs do not use Tor in the first version. Their
  address check in `src/main/public.ts` rejects `.onion` today, which is the right default.
- **Slower pages.** Tor tabs get longer time limits than the tool's default.

**What the user must be told, in the app**

- This is not Tor Browser. Sites cannot see the user's network address, but Chrome is easier to
  recognise than Tor Browser, so it should not be described as anonymous.
- Only the browser goes through Tor. The text the agent reads from a page is still sent to the model
  provider, and search, other tools and the model connection use the normal network.

**Open decisions**

- **Where Tor comes from.** Recommended: 11.2 first (use Tor already on the machine) and 11.4 only
  if people ask for it.
- **Order.** After the browser pane (3.9), since the indicator and tabs live there.
- Tor is restricted or blocked in some countries; bridges for those networks are left out of the
  first version.

## 12. Private and VPN browsing

The agent's browser can browse privately, leaving nothing behind, and through a VPN so sites do not
see the user's network address.

**What exists today:** nothing. The browser keeps one permanent profile with the user's logins
(`~/.kucedr/agent-browser`) and connects directly. If the user already runs a VPN for the whole
computer, the agent's browser goes through it with no work from Kucedr.

**What an app can and cannot do.** A VPN for the whole computer needs operating-system permission
(on macOS a special entitlement from Apple and signed builds) and is a different product. What
Kucedr can do itself is route its own browser through a VPN connection, leaving the rest of the
machine untouched.

| #    | Feature                                   | What the user gets                                                                                                                                             | Builds on                                                                           | Size |
| ---- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| 12.1 | Private tabs                              | A tab with no saved history, cookies or logins, wiped when closed; the agent can open one when asked                                                           | Browser pane (3.9); same disposable profile as Tor tabs (11.1)                      | S    |
| 12.2 | Browse through a proxy                    | The user enters the proxy address their VPN provider gives them; chosen tabs, or every tab, go through it                                                      | Same mechanism as Tor tabs: a browser instance started with a different connection  | S    |
| 12.3 | Browse through a VPN profile              | Import a WireGuard file from any VPN provider; the browser pane uses it, with no administrator rights and no effect on other apps                              | Needs a small bundled VPN program, shipped and updated like built-in Tor (11.4)     | L    |
| 12.4 | Route indicator and per-workspace default | The toolbar shows how each tab connects: direct, private, VPN or Tor. A workspace can default to one, for example work always through the company proxy        | Browser pane toolbar; workspaces (10)                                               | S    |

**One mechanism for sections 11 and 12.** Each tab has a route (direct, private, VPN, Tor). Private,
VPN and Tor tabs all run in a separate browser instance with a disposable profile and a chosen
connection. Building it once covers both sections.

**Rules the design keeps** (same as Tor tabs)

- No fallback: if the VPN or proxy drops, the tab fails and never reloads over the direct
  connection. Address lookups go through the same route.
- Private and VPN tabs never share the profile that holds the user's logins.
- Only the browser is routed. What the agent reads is still sent to the model provider, and search,
  other tools and the model connection use the normal network. The app says so where the route is
  chosen.

**Open decisions**

- **Whose VPN.** Recommended: bring-your-own first (12.2, then 12.3), so the user connects the VPN
  service they already pay for. Selling a Kucedr VPN through section 9 means running exit servers
  and handling abuse reports and legal requests, which is a business of its own; a partnership with
  an existing provider is the lighter way to offer it later.
- **First step.** 12.1 and 12.2 are small once the browser pane exists and deliver most of the
  value; 12.3 only if proxy addresses prove too awkward for users.
- **VPN credentials** are stored like other secrets (1.2).

## Constraints every detailed plan respects

- Provider and model behaviour stays in plugin manifests, not `src`.
- Saved data is upgraded by the app when it reads it, never by scripts editing `~/.kucedr`.
- New dependencies, tests and server migrations are called out as decisions, not assumed.
