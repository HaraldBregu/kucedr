# Target

Status: proposal, written 2026-11-27. Nothing here is decided. It turns the research in
[MARKETS.md](MARKETS.md), [FRONTIER.md](FRONTIER.md), [DIRECTIONS.md](DIRECTIONS.md) and
[MISSION.md](MISSION.md) into one target and an order of work. Statements about Kucedr come from a
read of `dev` and the [roadmap](../roadmap/README.md) on that date; nothing was run.

## Summary

- **Target: a private desk for online investigations and due diligence.** The buyers are small
  investigation firms, firms doing insurers' fraud work, due-diligence boutiques and anti-money-
  laundering consultants. Sell first in the UK and the USA, in English. Italy, in Italian, is the
  home channel.
- **One product, two prices**, as [MARKETS.md](MARKETS.md#the-recommendation-in-detail) proposes: €390 per seat a year
  with at least three seats for investigation firms; for due diligence, a €500 assisted pilot, then
  €49 per seat a month.
- **The character does not change.** [MISSION.md](MISSION.md) holds: the app stays free and MIT,
  sets no content rules, and keeps its protections. Firms pay for a desk licence (support,
  commercial terms, encrypted case backup), not for locked features.
- **Half the desk exists.** Cases (workspaces, built 26–27 November), routes per tab with no
  fallback, the shield, the vault, the app lock, screenshots and PDFs, a run record per chat,
  Fact-check, and the Word and PDF skills.
- **The other half is an evidence layer that does not exist.** A capture today is a file and a
  path. It records no address, time, route, hash or case. That layer is a new roadmap area:
  [Cases and evidence](../roadmap/EVIDENCE.md) (25).
- **Order:** sell before building (phase 0), the trust gates in parallel because every direction
  needs them (phase 1), the desk only if phase 0 passes (phase 2), then checkout and the website
  (phase 3).
- **Park** computer use, the coding page, the terminal panel, integrations, the rest of browser
  import, the plugin catalogue and paid plugins until the desk sells or the test fails.

## Why this target

| Question | Answer from the research |
| --- | --- |
| Do these buyers pay for tools? | Yes, self-serve, in Kucedr's price band: Hunchly €149 a year, Forensic OSINT $197 to $1,097 a year. At the top: Silo $1,450 to $3,450 per user, Maltego €3,000 to €7,500 ([MARKETS.md](MARKETS.md#markets-discovered)) |
| Does local and private matter to them? | Yes, for two reasons a cloud contract does not settle: the subject must not see who is looking, and evidence must hold up |
| Does Kucedr have an edge? | Partly: an agent and a browser in one window, routes per tab that cannot fall back, the shield, local models. No competitor found combines them |
| Does it fit the mission? | Yes. Defensive work, no content rules needed, protections are the product |
| What argues against it? | Hashed, timestamped capture is already standard. Maltego owns both ends of the price range. The pool is small (about 3,950 self-employed US investigators). Nobody was found paying for an agent-drafted, cited memo. Hence phase 0 |

The other directions were weaker on the evidence. The Italian studio desk scored lower on edge,
because every secrecy rule read allows hosted AI under contract; it stays a side test. Security
tooling is limited to hostile-link triage, which becomes a mode of this desk. Asia and Latin
America have no reachable paying buyer yet.

## The product

```text
open a case      -> a workspace with its own chats, sign-ins, captures and, optionally, its own memory
set the route    -> the case's default: direct, private, a named proxy, or Tor; never a fallback
browse and ask   -> user and agent share tabs; Fact-check is the case default
capture          -> every capture records address, final address, UTC time, route, SHA-256 and case
log              -> an append-only case log, each entry chained to the one before
write            -> a chronology or memo where every claim links to a capture
export           -> a bundle: memo, evidence list, files, case log, integrity note
check            -> a colleague recomputes hashes and the chain in a fresh profile
```

**Product rules.** [PRODUCT.md](PRODUCT.md#product-rules) rules 1 to 5 as written (evidence before
answers, the record is the product, protect the investigator, local first, the human concludes).
Then [MISSION.md](MISSION.md) section 7 for every claim: say "records the address, time and
SHA-256 of each capture", never "court-ready", "forensically sound" or "anonymous". Also: no
people-search or data-broker connectors ship with the app; screening data comes only through the
customer's own account; generated media never enters a case's evidence.

## The current implementation against the target

| Need | Built today | Gap | Planned in |
| --- | --- | --- | --- |
| Cases | Workspaces from a picked folder; own chats, browser sign-ins, tasks, permission rules and model (10.1–10.9) | Memory, knowledge and the Library are shared by every workspace (decided 2026-11-27). A fact learned in one client's case can surface in another's. No delete (10.5) | 10.5; new 10.10 |
| Routes | Direct, private, proxy and Tor per tab, no fallback, route indicator (11.1–11.3, 12.1, 12.2) | One proxy address with no login (`src/main/browser/connections.ts`); no per-case default; Tor checked against a fake SOCKS5 server only; background runs refuse every route but direct | 12.4; new 12.5; gate 4 |
| Capture | Screenshot (element or full page) and PDF of the tab (`src/main/agent/tools/web/browser/run.ts`), saved to the shared Library | No record of address, time, route, hash or case; no page archive; captures land outside the case | 25.1–25.3 |
| Record | `run.jsonl` per chat, one timestamped line per event | Not encrypted by the vault, not exported, not tamper-evident, not per case | 25.4; 1.3 |
| Verification | Fact-check mode; the `deep-research` skill; subagents | Claims are not linked to captures | 25.6 |
| Report | `docx`, `pdf` and `doc-coauthoring` skills; workspace export to Markdown, HTML and PDF | Relative links break outside the workspace ([SOFTWARE.md](SOFTWARE.md)); no evidence list | 25.7, 25.8 |
| Data at rest | Vault (AES-256-GCM, opt-in) for sessions, memory and health notes; app lock | Off by default; `run.jsonl` not covered; protects fully only on signed builds | 1.3; gate 2 |
| Local models | Setup with Ollama and no key (15.1) | Embeddings are remote; no recorded run of a local model using tools and the browser | 15.3; gates 3, 5 |
| Hostile pages | Shield: secret guard, local network block, held downloads, site permission denial | Page text reaches the model unmarked; no DNS-rebinding check | 13.10, 21.5 |
| Trust | Hardened runtime on macOS; legal pages (6.4) | Unsigned and not notarised; Electron 44.11.3 since 2026-11-27 (44.11.6 is newer but was days old); High audit items #1 (decision), #2, #3 and #6 (partial) open ([SECURITY_AUDIT.md](../SECURITY_AUDIT.md)) | 6.1, 21.x; gate 1 |
| Selling | Account, `kucedr://` links, legal pages | No checkout, entitlements or licence | 9.2–9.4; new 9.6 |

## Roadmap changes

- **New area 25, [Cases and evidence](../roadmap/EVIDENCE.md):** capture record, page archive,
  captures in the case, a chained case log, capture of pages the agent reads, claims linked to
  captures, the evidence bundle, a bundle check, trusted timestamps, a chronology and memo skill, a
  screening connector and the hostile-link mode.
- **New rows in existing areas:** 10.10 sealed case ([Workspaces](../roadmap/WORKSPACES.md)), 12.5
  proxy profiles with login ([Private and VPN browsing](../roadmap/VPN.md)), 9.6 desk licence
  ([Payments](../roadmap/PAYMENTS.md)).
- **Moved up:** signed builds (6.1), vault on by default and covering `run.jsonl` (1.3), local
  knowledge (15.3), untrusted content marking (13.10), sandbox egress (21.10), the per-case route
  (12.4), delete a workspace (10.5).
- **Moved down:** see [What waits](#what-waits).

## Order

### Phase 0: sell before building (December 2026 to early February 2027)

No new code. As [MARKETS.md](MARKETS.md#first-test) sets out:

1. One hour with an Italian criminal-law lawyer: Cyber Resilience Act manufacturer status, and arts.
   615-quater and 635-quater.1 of the penal code. No prepayment is asked for before the answer.
2. A demo on today's app (a routed tab, a screenshot, Fact-check, a memo) plus a clickable mock of
   the capture record and the bundle.
3. About 20 calls: 10 investigation firms (4 UK, 3 US, 3 Italy), 3 due-diligence boutiques, 2 AML
   consultants, and the ten-studio Italian test from [DIRECTIONS.md](DIRECTIONS.md#next-step).

**Pass:** at least 3 investigation firms prepay, at least €3,000 in total (letters of intent don't
count), or at least 2 paid due-diligence pilots. **If it fails:** keep 25.1 (the capture record) in
the free core, stop chasing investigation revenue, and decide from the studio test.

### Phase 1: trust gates (start now, in parallel)

These do not wait for phase 0, because every direction and every claim in MISSION.md needs them.

| Gate | Work | Size |
| --- | --- | --- |
| 1. Signed builds | A legal entity; Apple Developer ID and notarisation; Windows signing as an organisation (6.1, 21.8) | L |
| 2. Encryption on | Vault on by default for new installs, covering `run.jsonl` (1.3) | S–M |
| 3. Local knowledge | A local embedding model (15.3) | M |
| 4. Routes proven | Real Tor and real proxy, with a capture of the machine's traffic on macOS and Windows ([FRONTIER.md](FRONTIER.md#first-test)) | S |
| 5. Local run | One recorded case run with a local model using tools and the browser end to end | S |
| Security | Done 2026-11-27: Electron 44.11.3, MCP `readOnlyHint` auto-allow closed, DNS-rebinding check (21.5), restore holds code (21.3), sandbox egress step 1 (21.10: no local network or metadata). Open: sandbox egress allow-list (21.10 step 2), untrusted content marking (13.10) | S each; 13.10 M |

**Exit:** a signed release on which "encrypted on your computer" and "sites don't see your address
on Tor and proxy tabs" can be said ([MISSION.md](MISSION.md#7-words-and-when-they-can-be-used)).

### Phase 2: the desk (only if phase 0 passes)

| Item | Size |
| --- | --- |
| Capture record, page archive, captures in the case (25.1–25.3) | S–M each |
| Chained case log with export (25.4) | M |
| Sealed case (10.10), per-case route (12.4), proxy profiles with login (12.5), delete a workspace (10.5) | S–M each |
| Claims linked to captures, with Fact-check as the case default (25.6) | M |
| Evidence bundle and bundle check (25.7, 25.8) | M, S |
| Chronology and memo skill (25.10) | S |

**Exit:** an investigator runs a case from first search to exported bundle on a local model, and a
second person checks the bundle in a fresh profile after the original page has changed.

### Phase 3: sell

Desk licence (9.6) with checkout, entitlements and the customer portal (9.2–9.4); the website and
help pages rewritten for the desk (6.2, [LANDING_PAGE.md](../LANDING_PAGE.md)); a trust page; the
paid desk's terms with an acceptable-use clause. The free MIT app carries none. **Exit:** the first
three paying firms renew past their first quarter.

### Phase 4: grow

Trusted timestamps (25.9), the screening connector for due diligence (25.11), the hostile-link mode
after FRONTIER.md's demand gate (25.12), watching a subject (run history 16.2, catch-up 16.4, runs
while closed 16.7, and routes for background runs), team handoff of a case, then Canada.

## What waits

| Area | Why it waits |
| --- | --- |
| Computer use (24) | Not asked for by these buyers; needs signed builds and 13.10 first |
| Coding page (20) and terminal panel (14.2 onward) | Other audiences |
| Integrations (17) | Sends case data to Google and Microsoft; no buyer asked for it |
| Browser import beyond what is built (23) | Everyday browsing, not casework |
| Plugin catalogue and paid plugins (8) | No revenue found anywhere ([DIRECTIONS.md](DIRECTIONS.md#dropped-and-why)) |
| Kucedr Storage as a general product (9.1) | Replaced by encrypted case backup inside the desk licence |
| Voice approvals (19.3, 21.1) | Keep the security fix in the queue; voice is not part of the desk |
| More UI languages (7) | English and Italian are enough for phases 0 to 3 |

Small items already in flight can finish. Nothing is removed from the code.

## Open decisions

- **Adopt the target.** Recommended: yes, with phase 1 starting now and phase 2 only on a phase 0
  pass.
- **What firms pay for while the code stays MIT.** Recommended: a desk licence (commercial terms,
  support, encrypted case backup, help with the integrity note), with no feature locked. The risk
  is firms using the free app; phase 0 tests whether they prepay anyway. A closed desk plugin would
  pay more reliably but breaks MISSION.md's "free".
- **Memory and knowledge in a case.** Recommended: the sealed case option (10.10), on for new case
  workspaces. This reopens the 2026-11-27 decision for case workspaces only; the default workspace
  keeps shared memory.
- **Where captures live.** Recommended: in the case's own folder, not the shared Library, so delete
  and export cover them.
- **Timestamps.** Recommended: SHA-256 and UTC first; trusted timestamps (25.9) when a call asks
  for them, since an RFC 3161 request needs DER encoding (a new dependency or a small encoder).
- **Legal entity.** Recommended: as [MARKETS.md](MARKETS.md#open-decisions) says, the lightest
  entity that passes Windows signing as an organisation, before any paid pilot.

## Not verified

- Nothing was run. The gaps in the table come from reading the code and the roadmap.
- The 2026-11-27 workspace change (one sessions folder, shared memory) is not yet checked in the
  app.
- Whether Electron's `webContents.savePage` MHTML keeps every resource a capture needs was not
  tested.
- Phase sizes are the roadmap's rough guide. Phase 1's length depends on the signing paperwork,
  not the code.
