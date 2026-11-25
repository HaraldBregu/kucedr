# Product direction

Status: proposal, written 2026-11-25. Nothing here is decided or built. Statements about Kucedr
come from a read of the checkout on that date; market statements come from the
[sources](#sources) at the end, many of them vendors, and are marked where a figure could not be
checked.

## Summary

Kucedr can do almost everything a desktop AI assistant does, so it serves no one in particular. The
general assistant market belongs to the model companies. Meanwhile most of the recent work (a
browser pane with private, Tor and proxy tabs, a network shield, sealed secrets, local models)
points somewhere they do not go.

**Recommendation: make Kucedr a private desk for open-source investigations.** A journalist,
researcher or analyst browses the open and dark web without exposing themselves; the agent
collects and cross-checks; every page and capture is kept as evidence with its address, time and
hash; the report cites that evidence. Most of the parts exist. The missing ones are cases (the
planned multiple workspaces), a record for each capture, and a case log that can be exported.

Second choice, if investigations prove too small a market: a private workspace for confidential
professional work, which reuses the same privacy work.

## 1. Where Kucedr stands

About 47,000 commits since March 2025. The README offers "writing, research, coding, and creative
work"; the [landing page brief](../LANDING_PAGE.md) addresses "a technically curious knowledge
worker, developer, researcher, or AI power user". In practice that is everyone.

| Area                 | What exists today                                                                                                                                                                                                                                              | State                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Agent                | Tool loop; files with undo; sandboxed commands; subagents; Plan, Goal and Factchecker modes; permissions by location                                                                                                                                           | Built                                                                  |
| Browser              | Tabs shared by the user and the agent, with the agent cursor; direct, private, Tor and proxy routes with no fallback; shield (secret guard, local network block, held downloads, tracking parameters, site permissions); passwords, bookmarks, history, import | Built, the newest work. Tor checked against a fake proxy only          |
| Capture              | Screenshots (element or full page) and PDFs of pages; microphone, camera and screen recording                                                                                                                                                                  | Built. Files land in Library with no address, time or hash beside them |
| Knowledge and memory | Indexed folders (PDF, Office, HTML, text), searched by words and meaning; editable memory                                                                                                                                                                      | Built. One index for everything                                        |
| Automation           | Scheduled tasks with a tool allowlist and failure notices; `HEALTH.md` checks                                                                                                                                                                                  | Built. Runs only while the app is open                                 |
| Privacy              | Sealed keys; Privacy Mode through a local SOCKS5 proxy; local models through Ollama; offline notice                                                                                                                                                            | Partly built. No encryption at rest, no app lock                       |
| Activity record      | Each chat's `run.jsonl`, one timestamped line per run event                                                                                                                                                                                                    | Built. Not exported, not tamper-evident                                |
| Voice and media      | Realtime voice, dictation, read-aloud; image, video and sound generation                                                                                                                                                                                       | Built                                                                  |
| Integrations         | Google and Microsoft through MCP, with the user's own developer app                                                                                                                                                                                            | Partly built                                                           |
| Extras               | Arcade, Tetris, Triangle, Pulse and Taxes apps; a hidden coding page; 17 bundled skills, from inbox triage to front-end design                                                                                                                                 | Mixed                                                                  |
| Not built            | Multiple workspaces, payments, plugin catalogue, run history, runs while closed, model downloads, local embeddings                                                                                                                                             | In the [roadmap](../roadmap/README.md)                                 |

Three conclusions:

- **No one to sell to.** An assistant for everything competes with Claude Cowork, the ChatGPT
  desktop app, Gemini and Copilot, which own the models, the distribution and the free tiers, and
  with open-source agents such as OpenClaw.
- **Breadth costs.** A password manager, games, a tax calculator, a media studio and a coding page
  each meet a specialist, and the roadmap keeps 23 areas moving.
- **The recent work already has a direction.** Routes per tab, the shield and the secret guard are
  not what general assistants build. They are what someone researching hostile or sensitive
  subjects needs.

## 2. What the market says

Read on 2026-11-25.

- **Standalone AI browsers did not take hold.** OpenAI closed ChatGPT Atlas on 9 August 2026, less
  than a year after launch, and moved its agentic browsing into the ChatGPT desktop app and a
  Chrome extension. Agents now arrive inside mainstream browsers instead, such as Chrome's
  auto-browse and Claude in Chrome.
- **General desktop agents are crowded.** Claude Cowork comes with the Claude Pro and Max plans;
  OpenClaw leads the self-hosted agents, with many younger projects behind it; the model companies
  ship their own.
- **Private research notebooks are crowded too.** Open Notebook, SurfSense, KnowNote and Elephas
  are local NotebookLM-style tools. Searching one's own documents is not a product on its own.
- **Method matters as much as tools.** Courts generally ask for authenticity and a chain of custody
  before admitting digital material (Berkeley Protocol, UN human rights office and UC Berkeley,
  2020). The Reuters Institute reports that generative AI makes fabrication easier and detection
  harder, and quotes an investigator who treats language models as "an advanced search machine",
  not as proof.
- **The market is large but mostly institutional.** Estimates for open-source intelligence (OSINT)
  put 2025 between $12.7 and $18.2 billion, growing 15 to 27% a year; most of it is government and
  enterprise. Kucedr can reach individuals and small teams.
- **Misuse is real.** Open-source research is used for doxxing and harassment, and collecting
  public facts about one person can amount to stalking under some laws. Vendors publish ethics
  policies; few show how they enforce them.

Investigation tools today are split by task, and none is a local AI desk:

| Tool                                      | What it does                                                                           | Price signal                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| Hunchly (Maltego since 2025)              | Browser extension that captures every page visited into a case                         | $169 or €149 a year                         |
| Forensic OSINT                            | Browser capture with reports                                                           | ELITE plan $1,097 per user a year           |
| Authentic8 Silo                           | Cloud browser that hides who is browsing ("managed attribution")                       | $1,450 to $3,450 per user a year, as listed |
| OSIRT                                     | Local investigation browser, born in UK police training; case files, capture, hashing  | Paid, price not public; 30-day trial        |
| Bellingcat Auto Archiver                  | Archives links with hashes, timestamps and screenshots; 150,000+ items kept            | Free, open source                           |
| Nexus, OSINT Pilot, AegisStack, OpenOSINT | Agents that run OSINT tools and return findings                                        | Cloud services or terminal tools            |
| Newsroom builds                           | The New York Times' internal "uber agent"; tools on self-hosted LibreChat              | In-house                                    |

Kucedr would be the one that puts the browser, the agent, the evidence and the knowledge on the
investigator's own machine, with the model of their choice.

Each tool has a research note in this folder: [Maltego and Hunchly](MALTEGO.md),
[Forensic OSINT](FORENSIC_OSINT.md), [Authentic8](AUTHENTIC8.md), [OSIRT](OSIRT.md),
[Bellingcat](BELLINGCAT.md), [Nexus](NEXUS.md), [OSINT Pilot](OSINT_PILOT.md),
[AegisStack](AEGISSTACK.md) and [OpenOSINT](OPENOSINT.md).

## 3. Directions considered

| #   | Direction                                                                   | Fit with what exists                                                     | Competition                                 | Willingness to pay                                          | Verdict         |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------- | --------------- |
| 1   | Investigation desk                                                          | High: routes, shield, capture, knowledge, Factchecker, tasks, run record | Split across tools; priced for institutions | High: $169 to $3,450 per seat a year                        | **Recommended** |
| 2   | Private workspace for confidential work (lawyers, accountants, consultants) | Medium: local models and Privacy Mode; no encryption at rest or app lock | Legal AI platforms; local model apps        | High, but buyers expect certifications Kucedr does not hold | Second choice   |
| 3   | Privacy-first AI browser for everyone                                       | High                                                                     | Chrome, Edge, Brave, Comet; Atlas closed    | Low                                                         | No              |
| 4   | Personal assistant (mail, calendar, reviews, voice)                         | High                                                                     | Cowork, ChatGPT, Gemini, OpenClaw           | Medium                                                      | No              |
| 5   | Local research notebook                                                     | Medium                                                                   | Many free tools                             | Low                                                         | Part of 1       |
| 6   | Web monitoring for competitor news                                          | Medium: tasks stop when the app closes                                   | Monitoring services from around $10 a month | Medium                                                      | Part of 1       |
| 7   | Coding agent                                                                | Low: the page is hidden                                                  | Claude Code, Codex, Cursor                  | High                                                        | No              |
| 8   | Media studio                                                                | Medium                                                                   | Web studios with many models                | Medium                                                      | No              |

Why 1 before 2: direction 2 needs encryption at rest, an app lock and stronger local models before
it has a story, and its buyers expect compliance work a one-person project cannot carry yet.
Direction 1 ships on what exists plus three features, and what it adds later (encryption, app lock,
local models, separate cases) is what direction 2 needs anyway.

## 4. The product

**Kucedr, the private desk for investigations.** Browse without exposing yourself. Let the agent
collect and cross-check. Keep every page as evidence. Write the report with its sources.

### Who it is for

- Investigative journalists and fact-checkers, alone or in small units.
- Human-rights and NGO researchers documenting events.
- Due-diligence and corporate investigators checking companies and the people behind them.
- Threat-intelligence and trust-and-safety analysts in small teams.

Not for finding or watching private individuals, and not for bulk surveillance. Police and
government buyers need procurement and certification work the first versions will not have.

### Jobs it does

1. Research a subject (a company, a public figure, an event, a claim, a network) on the open web
   and `.onion` sites without revealing who is asking.
2. Preserve what was found before it changes or disappears, in a form someone else can check.
3. Verify: cross-check claims, find primary sources, examine images and video.
4. Keep cases apart and resume one where it was left.
5. Watch a subject and hear what changed.
6. Deliver a report in which every claim points to captured evidence.

### The loop

```text
open a case -> browse and ask: user and agent share tabs, each tab has a route
            -> capture: address, time, route and SHA-256 kept for each item
            -> verify: Factchecker by default, no source means no claim
            -> report: claims linked to captures, evidence list and case log attached
            -> watch: scheduled checks capture changes and say what changed
```

Example: a reporter checks whether a company named in a leak is a shell. They open the case "Acme
shell check" with the proxy route as its default. The agent searches company registries, archived
versions of the company site and the directors' other companies; each page it reads is captured
with its hash. Factchecker marks one claim that has a single source. The reporter exports a memo
with the claims table, the evidence list and the case log, and sets a weekly check on the registry
entry.

### Product rules

1. **Evidence before answers.** A claim in a case answer points to a capture or a fetched source.
   Unverified claims are marked as such.
2. **The record is the product.** Every action has a time and every capture a hash; the case log
   exports for someone else to check.
3. **Protect the investigator.** A route per tab with no fallback, the shield on, and plain words
   about the limits: Kucedr's browser is not Tor Browser and is easier to recognise.
4. **Local first.** Case data stays on the machine. A case can be held to a local model, and it
   shows which providers have received its data.
5. **The human concludes.** The agent searches, collects and suggests; the investigator decides.
   Actions with side effects ask first.
6. **Legitimate work only.** Each case states its purpose. No data-broker or people-search
   connectors ship with the app. Generated media never enters a case's evidence.

## 5. From what exists to the product

| Need             | Built today                                                          | Gap                                                                                                                                                                                                                              | Roadmap item or new                                                 | Size        |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- |
| Cases            | One workspace                                                        | A case is a workspace with its own files, chats, memory, knowledge index and browser sign-ins                                                                                                                                    | [10.1, 10.2, 10.3](../roadmap/WORKSPACES.md); index per case is new | M + M + M–L |
| Safe browsing    | Private, Tor and proxy tabs; shield                                  | A default route per case; proxies with a password; a check against the real Tor network                                                                                                                                          | [12.4](../roadmap/VPN.md); the rest new                             | S each      |
| Evidence capture | Screenshot and PDF into Library                                      | A record per capture: address, final address, title, UTC time, route, SHA-256 and case; a full page archive (MHTML through Electron's `webContents.savePage`, no new dependency); optional capture of every page the agent reads | New                                                                 | M           |
| Case log         | `run.jsonl` per chat                                                 | Export as readable text and JSON; a hash chain so a removed entry shows                                                                                                                                                          | New                                                                 | S–M         |
| Verification     | Factchecker mode; `deep-research` skill; subagents; search and fetch | Factchecker as the case default; a claims table linking each claim to its captures; a media verification skill (frames, metadata, reverse image search links)                                                                    | New                                                                 | S–M         |
| Monitoring       | Tasks while the app is open                                          | Run history, catch-up, runs while closed; a watchlist skill that captures a page when it changes                                                                                                                                 | [16.2, 16.4, 16.7](../roadmap/AUTOMATION.md); skill new             | S + S + L   |
| Report           | `docx`, `pdf` and `doc-coauthoring` skills                           | A report skill that appends the evidence list and case log                                                                                                                                                                       | New skill                                                           | S           |
| Audio and video  | Speech-to-text adapters; `media` skill                               | A chat tool that transcribes a saved file (Voice keeps its realtime-only rule)                                                                                                                                                   | New                                                                 | S–M         |
| Data at rest     | Sealed keys                                                          | Encryption at rest, app lock, encrypted backup                                                                                                                                                                                   | [1.3, 1.4, 1.5](../roadmap/PRIVACY.md)                              | L + S–M + M |
| Hostile pages    | One line in the system prompt                                        | Web content marked untrusted before the model reads it: an investigated site may target the investigator                                                                                                                         | [13.10](../roadmap/SHIELD.md)                                       | M           |
| Trust            | Unsigned builds                                                      | Signed and notarised builds; a network view of what each case contacted                                                                                                                                                          | [6.1](../roadmap/DISTRIBUTION.md), [13.8](../roadmap/SHIELD.md)     | L, M        |

Later: people, organisations, places and dates pulled from captures into a case timeline, shown in
an app window.

## 6. Keep, move, stop

- **Keep in the core:** the agent, the browser and its routes, the shield, capture, knowledge,
  memory, tasks, voice, the Plan, Goal and Factchecker modes, and the `deep-research`, `pdf`,
  `docx`, `xlsx`, `data`, `media` and `doc-coauthoring` skills.
- **Move to optional plugins:** the Arcade, Tetris, Triangle, Pulse and Taxes apps; the personal
  skills (`inbox-triage`, `calendar-planning`, `weekly-review`); the developer skills
  (`code-review`, `frontend-design`, `webapp-testing`). They keep working for anyone who installs
  them.
- **Off inside cases:** image, video and sound generation. Generated media beside evidence invites
  mistakes. Outside cases it stays available.
- **Stop:** the coding page, which answers "ship or remove" in [Coding](../roadmap/CODING.md); and the
  browser import items that serve everyday browsing (sign-in import 23.5, addresses 23.11, form
  history 23.12). New chat and media providers wait.
- **Reorder:** Kucedr Storage (9.1) is no longer the first thing to sell; see
  [How it pays](#8-how-it-pays).

## 7. Order

| Phase                | Contents                                                                                                                                                                                                 | Outcome                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Case desk         | Cases (10.1, 10.2); capture records; case log export; Factchecker and a default route per case (12.4); report skill; README and landing page rewritten                                                   | An investigator runs a case from first search to cited report     |
| 2. Protect and watch | Untrusted content marking (13.10); encryption at rest and app lock (1.3, 1.4); run history and catch-up (16.2, 16.4); watchlist skill; network view (13.8); tracker blocking (13.1); signed builds (6.1) | Sensitive cases are safe on the machine; monitoring is dependable |
| 3. Teams and paid    | Separate sign-ins per case (10.3); encrypted backup (1.5); a case export a colleague can open and check; transcription tool; local embeddings (15.3); runs while closed (16.7); the first paid plan      | Small teams share cases, and the product earns                    |

Phase 1 is three M items and four S items on the roadmap's scale, roughly five to eight weeks. The
small items already in flight (storage management, knowledge sources at a glance, the honest
catalogue) help either way and can finish first.

## 8. How it pays

- The core stays open source under MIT. For investigators that is a feature: they can check what
  touches their data, as they can with OSIRT and Bellingcat's tools.
- Sell what the open-source app cannot do alone: encrypted case backup and sync (after 1.5),
  hosted search and model access for people who do not want their own keys (9.5), and support.
- Price between single-purpose tools and institutional platforms: Hunchly is $169 a year, Forensic
  OSINT's ELITE plan $1,097 and Silo from $1,450 per user. A hypothesis to test: €15 to €25 per
  user a month.
- Consider free plans for non-profit newsrooms and human-rights groups. Their use is the reference
  this market trusts.

## 9. How to know it works

Before phase 1:

- Talk to ten people who investigate for a living (journalists, due-diligence analysts, NGO
  researchers): what they use, what they pay, where evidence gets lost, and whether they would
  trust a local AI desk.
- Put the new positioning on the website with a beta list and see who joins.

After phase 1:

- Track cases opened per active user each week, captures per case, the share of report claims
  linked to a capture, and users with a case still active four weeks later.
- Agree a threshold before launch, for example 20 people working in a case every week after three
  months. Below it, change course to direction 2, which keeps most of the work.

## 10. Risks and safeguards

| Risk                                | Safeguard                                                                                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use for stalking or harassment      | A stated purpose per case; no data-broker or people-search connectors bundled; no automated account creation; published terms and an ethics policy; Tor tabs keep asking. A local app cannot police its users, and the docs say so |
| Overclaiming                        | Say "records the address, time and SHA-256 of each capture", not "court-ready" or "forensically sound", and never "anonymous". The accuracy rules in [LANDING_PAGE.md](../LANDING_PAGE.md) extend to this                          |
| Hostile pages instructing the agent | 13.10 moves up; the secret guard already stops stored keys leaving                                                                                                                                                                 |
| A recognisable browser              | Tor tabs are not Tor Browser, and hiding the browser's fingerprint is out of scope; the app says so where a route is chosen                                                                                                        |
| Case data reaching a model provider | A model per case, local models, Privacy Mode; the case lists which providers received its data                                                                                                                                     |
| Unsigned builds                     | Signed builds (6.1) before selling to professionals                                                                                                                                                                                |
| One maintainer                      | The narrower scope is part of the answer: fewer areas to keep working                                                                                                                                                              |

## 11. If adopted

These change with the decision, not before it: the README's opening and feature list, the
positioning in [LANDING_PAGE.md](../LANDING_PAGE.md), the recommended order in the
[roadmap](../roadmap/README.md), and the [multiple workspaces plan](../WORKSPACES.md), which today
separates files only.

## Open decisions

- **The direction.** Recommended: the investigation desk, with direction 2 as the fallback.
- **The name.** Recommended: keep Kucedr and change the positioning line rather than name an
  edition.
- **How much a case separates.** Recommended: everything (files, chats, memory, knowledge,
  sign-ins). This settles the first open decision in [Multiple workspaces](../roadmap/WORKSPACES.md).
- **Generated media in cases.** Recommended: off.
- **What is sold first.** Recommended: encrypted case backup, one plan, one price.

## Sources

Read 2026-11-25. Vendor pages describe their own products.

- [OpenAI's ChatGPT Atlas browser is shutting down](https://www.macrumors.com/2026/07/10/openais-chatgpt-atlas-browser-shutting-down/), MacRumors, 2026-07-10
- [What will happen when ChatGPT Atlas shuts down](https://9to5mac.com/2026/08/04/openai-explains-what-will-happen-when-chatgpt-atlas-shuts-down-this-weekend/), 9to5Mac, 2026-08-04
- [The AI browser landscape in 2026](https://www.searchviu.com/en/ai-browsers-2026-compared/), searchVIU
- [Claude Cowork vs OpenClaw](https://adapt.com/blog/claude-cowork-vs-openclaw), Adapt
- [The 2026 AI agent landscape](https://sawinyh.com/blog/ai-agent-landscape-2026/), Nick Sawinyh
- [NotebookLM alternatives worth considering in 2026](https://www.eweek.com/news/5-notebooklm-alternatives-2026/), eWeek
- [Hunchly plans and pricing](https://hunch.ly/pricing) and [Hunchly's story](https://hunch.ly/about-hunchly-story)
- [Forensic OSINT ELITE plan](https://www.forensicosint.com/bogo), vendor
- [Silo plans and pricing](https://authentic8.com/products/sfrold/pricing/) and [what managed attribution is](https://authentic8.com/resources/what-is-managed-attribution/), Authentic8
- [OSIRT, an investigative tool for law enforcement](https://pure.canterbury.ac.uk/en/publications/open-source-internet-research-tool-osirt-an-investigative-tool-fo-2/), Canterbury Christ Church University
- [Auto Archiver](https://bellingcat.gitbook.io/toolkit/more/all-tools/auto-archiver), Bellingcat, and [its 150,000 preserved items](https://www.niemanlab.org/2025/08/it-just-got-easier-to-make-an-archival-copy-of-that-website-youre-digging-into/), Nieman Lab, 2025-08
- [Nexus](https://www.nexus-osint.ai/agentic-osint), [OSINT Pilot](https://osintpilot.com/), [AegisStack](https://www.aegisstack.ai/), [OpenOSINT](https://geantechnology.com/2026/07/25/openosint-ai-powered-intelligence-investigation-platform/)
- ["Uber agents," undercover AI personas, and other ways newsrooms are using AI in investigations](https://www.niemanlab.org/2026/10/uber-agents-undercover-ai-personas-and-other-ways-newsrooms-are-using-ai-in-investigations/), Nieman Lab, 2026-10
- [AI is undermining OSINT's core assumptions](https://reutersinstitute.politics.ox.ac.uk/news/ai-undermining-osints-core-assumptions-heres-how-journalists-should-adapt), Reuters Institute
- [Berkeley Protocol on Digital Open Source Investigations](https://humanrights.berkeley.edu/publications/berkeley-protocol-on-digital-open-source-investigations/), UC Berkeley Human Rights Center and OHCHR
- [Open-source intelligence market](https://www.mordorintelligence.com/industry-reports/open-source-intelligence-market), Mordor Intelligence, and [OSINT market](https://www.gminsights.com/industry-analysis/open-source-intelligence-OSINT-market), Global Market Insights
- [The dark side of OSINT](https://www.counterextremism.com/blog/dark-side-osint-how-extremists-exploit-open-source-intelligence), Counter Extremism Project
- [AI website monitoring tools in 2026](https://visualping.io/blog/top-ai-website-monitoring-tools), Visualping, vendor
