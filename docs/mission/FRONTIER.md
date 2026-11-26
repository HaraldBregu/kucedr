# What Kucedr could be: third search

Status: proposal, written 2026-11-26. Nothing here is decided or built. It answers the owner's
question: can Kucedr be software for researchers, discovery, hacking, security, something very
important? "Hacking" means authorised security work: penetration testing, bug bounty, vulnerability
research, CTF, red teaming and defensive analysis. Read for it: [MISSION.md](MISSION.md),
[DIRECTIONS.md](DIRECTIONS.md), the headings and product rules of [PRODUCT.md](PRODUCT.md), and a
research dossier of ten tracks, each checked by a second pass. Code statements come from a read of
`dev`; nothing was run. "Secondary" marks a figure from press, an aggregator or a search snippet.
Corrections are carried; refuted claims are dropped; gaps are [at the end](#not-verified).

## Summary

- **Yes, but as defensive software, not as a hacking tool.** The code is built to handle hostile
  content safely: routes per tab with no fallback, the shield, held downloads, a renderer sandbox,
  local models. The agent's command sandbox cannot listen on ports and, on macOS since 2026-11-25,
  cannot reach local ports; that raw sockets and UDP fail is inferred from the runtime's README, not
  tested. The terminal and elevated commands are not fenced, so the app does not stop a user from
  running security tools. It only stops the agent from doing so unasked.
- **No security direction beats the two in DIRECTIONS.md.** The best fit, safe handling of hostile
  links, is a feature of direction 2: it needs the same capture record and case workspaces. The
  existing protections do most of the work; remote-detonation connectors, hashing, the capture
  record, case workspaces and signed builds are still to build. The only local tool in these fields
  shown to be paid for is Hunchly's evidence capture, at €149 a year. Ask about link triage during
  the existing buyer test and build nothing specific until direction 2 passes
  ([first test](#first-test)).
- **Second: no at-risk product until builds are signed and the High audit items are closed.**
  Grants are the only money found that is open to Kucedr itself and verified on primary pages (HRF,
  OTF and NLnet programme terms); OTF's budget outlook is secondary. They fund that trust work.
- **Third: a prompt-injection bench, kept internal** as the regression suite for untrusted-content
  marking ([13.10](../roadmap/SHIELD.md)). Publish only after 13.10 ships and the MCP read-only gap
  is closed.
- **Vulnerability-report triage: interviews only.** The pain is documented; no payer is.
- **Do not build a pentest workbench and do not market Kucedr for "hacking".** Burp AT, in public
  beta for Burp Pro users, already keeps scope and approval rules in Burp rather than in the model.
  Strix and Shannon cover local models, and the misuse record is primary.
- **The research desk stays dropped.** New evidence strengthens the drop in DIRECTIONS.md.

## What the software can do today for these fields

| Ability | State in code | Limit |
| --- | --- | --- |
| Routes per tab | Direct, private, proxy, Tor with `fixed_servers` and no direct fallback (`src/main/agent/tools/web/browser/prepare.ts`) | Tor checked against a fake SOCKS5 server only ([TOR.md](../roadmap/TOR.md)); one global proxy address; pane only: background runs use headless system Chrome, direct, and refuse private, Tor and proxy (`use_web_browser.ts:322`) |
| Leak and local-network control | Non-proxied WebRTC UDP disabled on routed tabs (`create.ts:58-62`); routed tabs always denied local and private hosts (`src/main/shield/verdict.ts`) | No DNS-rebinding check on direct tabs (`shield/local.ts` judges by name); no fingerprint work |
| Downloads | Held paused in a temp folder; Tor tabs never download (`hold.ts:12-38`) | No hash, no quarantine attribute, no sample handling |
| Capture and inspection | Screenshot, PDF, console, `evaluate` in the page (`use_web_browser.ts`) | No network capture of the page; the model cannot see images ([COMPUTER.md](../roadmap/COMPUTER.md)) |
| Command sandbox | sandbox-runtime 0.0.75; read-only variant denies all network; credential paths read-denied | `allowedDomains: ['*']`; local-port block documented for macOS only, set 2026-11-25 ([21.10](../roadmap/SECURITY.md)); `NO_PROXY` for private ranges, so lab targets most likely fail |
| Host paths | Elevated commands, terminal, stdio MCP | Run unfenced; elevated asks every time and is never remembered; all refused under Privacy Mode (`src/main/privacy/state.ts:52-54`) |
| MCP | Stdio or Streamable HTTP, plain http only on loopback; stored permission pinned to a tool-definition hash | Any tool that declares `readOnlyHint`, new or changed, is allowed without asking unless the server is set to "always"; the hint is self-declared (`src/main/mcp/mcp_tool_permission.ts:13-16`) |
| Record | `run.jsonl` per session; approvals bound to an input fingerprint, 120 s expiry | Not exported, not tamper-evident |
| Models | Any model through Ollama or a Custom endpoint; no content rules | Page text reaches a hosted model unless a local one is used (`use_web_browser.ts:276-280`); local-only run with tools never done |
| Distribution | Hardened runtime on macOS | Not notarised; Windows signing not forced; no fuses; Electron 44.4.5 (Chromium 152.0.7977.130) while 44.x has reached at least 44.11.6; High audit items #1 (Decision), #2, #3, #6 (Partial) in [SECURITY_AUDIT.md](../SECURITY_AUDIT.md) |

What it means for Kucedr: the base fits "safe hands on hostile content". It does not fit an
autonomous offensive agent without loosening protections MISSION.md keeps.

## Offensive security: pentest and bug bounty

**Who and what they pay.** Freelance and boutique testers, and hunters. Burp Pro shows "BUY - $499"
with no billing period stated; Caido's US baseline was $20 a month or $200 a year in August 2025;
Shannon Pro is $50 per active developer a month. HackerOne customers paid researchers $89M from
July 2025 to June 2026 (no community size given). Bugcrowd reports 82% of over 2,000 hackers use AI
(2026-01-27).

**Competitors.** Burp AT is in public beta for Pro users, with no GA date or price; PortSwigger's
page says "Scope, tool access and approval rules live in Burp's tooling layer, architecturally
separate from the model". Open source on 2026-11-26: Strix 77,656 stars, Shannon 52,331, PentAGI
35,063, PentestGPT 16,631, HexStrike AI 13,923; Strix and Shannon support local models. Funded
platforms: XBOW $120M Series C on 2026-03-18 at over $1B; Horizon3 $250M Series E on 2026-08-03 at
over $2B, over 7,000 organisations. Kali ships `mcp-kali-server`, updated 2026-11-18.

**Kucedr's edge.** None that holds. The sandbox blocks listeners and, on macOS, localhost; raw
sockets most likely fail (inferred, not tested). Scope has a setting (`allowedDomains`) but CIDR
ranges are undocumented; the gap is M for proxied traffic per the capabilities track, more if
elevated commands, the terminal and stdio MCP must be fenced too. Strix's docs say most local models
under 70B struggle and "strongly recommend" cloud models for critical work; they blame most
tool-call failures on inference-server configuration and keep local models for when privacy is the
absolute priority. No source shows anyone paying for scope enforcement or local processing.

What it means for Kucedr: drop it. Scope as a protection the user sets stays possible later.

## Defensive security and threat intelligence

**Who and what they pay.** Employers of CTI, trust-and-safety and phishing analysts pay for remote
detonation: urlscan Automate $5,000 a year, Professional $1,250 a month or $12,500 a year with
10,000 Residential/Tor scans a day; a free API tier gives 50 private scans a day. Hunchly sells
local evidence capture at €149 or $169 a year. DarkOwl lists $38,000 for 12 months on AWS
Marketplace, but the same listing carries a $100,000,000 placeholder.

**Competitors.** Platform AI is bundled: Security Copilot comes with Microsoft 365 E5 at 400 SCUs a
month per 1,000 licences, capped at 10,000; CrowdStrike gives qualifying Falcon customers 50 free
Charlotte credits a month. AI SOC startups are funded at scale (Torq $140M Series D at $1.2B).
Gartner's hype-cycle placement of AI SOC agents comes only from vendor-sponsored coverage.

**Kucedr's edge.** Real for small teams and individual analysts: routed tabs that cannot fall back
or reach the LAN, held downloads, capture, local models. It cannot be an AI SOC: no SIEM or EDR
telemetry. In Italy, NIS2 incident notification has been mandatory since 1 January 2026 (diritto.it,
secondary; ACN text not read); "over 20,000 entities" is secondary, not an ACN figure.

What it means for Kucedr: the best fit of any field, with weak money evidence. It fits as a feature
of DIRECTIONS.md direction 2, not as a direction of its own.

## Vulnerability research and report triage

**Who.** Maintainers and small PSIRTs on the receiving end. curl ended its bounty on 2026-01-31
after over $100,000 paid for 87 confirmed vulnerabilities since April 2019. Anthropic's scanner
flagged more than 29,000 candidates, triaged about 6,000, sent nearly 5,000 unverified reports to
maintainers who asked for everything, and says it is "bottlenecked on our human capacity to
validate these findings". Its dashboard lists 5,087 vulnerabilities across 680 projects
(2026-11-02). Under the CRA, manufacturers report actively exploited vulnerabilities from
11 September 2026; when stewards' duty starts is [not verified](#not-verified).

**Competitors.** Free hosted help: Claude Code Security gives maintainers expedited access, Codex
Security offers pro-bono scanning and has contributed to over 3,000 fixed critical or high
vulnerabilities, ZeroPath is free for researchers by application. The strongest models are gated:
Mythos Preview to about 200 organisations.

**Kucedr's edge.** Thin. Local handling of embargoed details is real. Network PoCs need a container
or VM (L); the coding page is hidden and supports only Codex `app-server`
([CODING.md](../roadmap/CODING.md)); local-model code reasoning is unchecked.

What it means for Kucedr: no build. Interviews, and an NLnet CodeSupply proposal only if they show use.

## Science and discovery

**What they pay.** Elicit Pro $49 and Scale $229 a user a month, billed annually; Undermind Pro $16.
In Italy the CRUI contract prices ChatGPT Edu at €7.05 a month plus VAT with a 20,000-licence
minimum; PoliTo staff pay €103.12 a year themselves.

**Competitors.** OpenAI gives eligible researchers three free Plus seats for up to 12 months from
2026-11-23; Prism is free and shuts down on 2027-01-01; Consensus claims 2.5M monthly users and a
$30M round dated 2026-11-25; free Zotero plugins run local models. Edison ($70M seed), Periodic Labs
and Lila work at another scale.

**Kucedr's edge.** Confidential pre-filing work is a real need, but the only local-processing
evidence is one study of 44 novices in which 9 prioritise isolation and only 2 are described as
using local models. The only bundled embedding models are OpenAI text-embedding-3-small and -large
(`resources/plugins/openai/models/`); local embeddings are proposal 15.3 in
[LOCAL.md](../roadmap/LOCAL.md).

What it means for Kucedr: confirms the drop of the research desk in DIRECTIONS.md.

## People at risk: journalists and human-rights researchers

**Need.** Rome and Naples prosecutors confirmed Fanpage director Francesco Cancellato was infected
with Paragon Graphite (TechCrunch, secondary). Cite Cancellato: prosecutors found no evidence on
Ciro Pellegrino's phone. HURIDOCS found 80% of 52 defenders had basic or intermediate skills
(secondary).

**Who pays.** Grants, verified on primary pages. HRF AI for Individual Rights Fund: rolling,
"typically not exceed $200,000", no closed-source tools; its fund page aims at activists and civil
society under authoritarian rule; its application form accepts a "Personal Capacity" applicant.
OTF Internet Freedom Fund: $10,000 to $900,000, individuals of any nationality; the government's
appeal was dismissed by joint stipulation on 2026-04-15 (docket, secondary; reason not stated); the
open risk is FY2027. NLnet: €5,000 to €50,000 first grant, next deadline 2027-01-03 12:00 CET,
proposals "made by humans, not AI", prompts disclosed if AI was used. Closed to this owner:
Sovereign Tech Fund (over €50,000, no prototypes), Common Good Cyber (nonprofits, closed
2026-08-04). Prototype Fund residence is unverified.

**Competitors.** The tools this audience trusts avoid AI: Tor Browser 15.0 (28 Oct 2025) lists
"Drop AI and machine learning components"; Dangerzone's homepage and MVT's README mention no AI.
HRF's page says "Agents are not privacy tools. Users should not give them any sensitive
information". Robin (8,110 stars, MIT) does Tor OSINT with Ollama, a web UI and an MCP mode.

What it means for Kucedr: highest stakes and closest to MISSION.md, but a large unsigned Electron
agent is the wrong object to hand to spyware targets today. Use the grants to fund the trust work.

## Security for AI agents

**State of the field.** Consolidated at the top: Palo Alto/Protect AI, Check Point/Lakera,
SentinelOne/Prompt Security, Snyk/Invariant, OpenAI/Promptfoo (announced 2026-03-09), Vanta/Pillar,
CrowdStrike/Dreadnode and Fiddler (about $495M per WSJ, secondary). Free at the bottom: garak
(10.2k stars), PyRIT, Inspect, Promptfoo community, Cisco mcp-scanner (1.1k), Pipelock (about 1.0k
stars, `pipelab-org`, v3.8.0, also checks DNS rebinding and MCP tool poisoning).

**Evidence.** Anthropic measured browser-agent attack success of 8.0% to 13.8% model-only and 1.4%
to 2.4% with safeguards. OpenAI says prompt injection is "unlikely to ever be fully solved" and
advises logged-out browsing, site limits and confirmations. One search found no comparable figures
for open-weight local models in a browser agent.

What it means for Kucedr: no product to sell, but an internal bench makes "secure" a measurement.

## Individual power users

Attention is taken: OpenClaw 395,255 stars, Ollama 188,176, Open WebUI 159,593, Goose 57,018 under
the Linux Foundation; Kucedr 12. Privacy chat sells as hosted service (Lumo Plus $9.99 a month
billed yearly; Confer about $35, secondary). The gap the evidence supports is narrow: an interactive browser
shared by user and agent, routes per tab and capture in one app. That rests on one search.

What it means for Kucedr: no new direction; it feeds the open-client extras in DIRECTIONS.md.

## Legal and platform limits

| Limit | Fact | Effect |
| --- | --- | --- |
| Art. 615-ter c.p. | Up to 3 years basic, on complaint; 2 to 10 aggravated; 3 to 10 or 4 to 12 for public-interest systems (Brocardi, secondary) | Binds users who exceed authorisation |
| Arts. 615-quater, 635-quater.1 | Need "abusivamente" plus a specific aim (advantage, harm, unlawful damage); up to 2 years and €5,164 or €10,329 | A general tool is not covered on its face; marketing matters. Needs a lawyer |
| No safe harbour | ACN's CVD policy (7 Oct 2026) has no non-punishment clause; CSIRT staff must report ex-officio offences (secondary) | No disclosure feature that invites untested reports |
| CRA | Non-monetised FOSS out of scope; "monetised" undefined | A paid tier probably makes the owner a manufacturer: reporting since 11 Sep 2026, main duties from 11 Dec 2027 |
| AI Act | FOSS excluded except Article 5, Article 50 and high-risk | AI disclosure and media marking still apply; firms disagree on the 50(2) transition date |
| Anthropic | AUP (12 Nov 2026) allows authorised work; CVP Red Team Access is for organisations only; third-party platforms offer CVP tiers only through account linking; Defense Access excludes static or long-lived API keys from 15 Dec 2026 | With a stored long-lived key, Kucedr users will most likely get default safeguards; adjusted access through a third-party client needs account linking Kucedr does not offer. Not confirmed with Anthropic |
| OpenAI | Policy (20 Nov 2026) bans "unsolicited safety testing" and "circumventing our safeguards"; Daybreak needs a paid plan and a FIDO2 key | "No content rules" must never mean bypassing provider safeguards |
| Misuse record | GTIG/Mandiant (2026-10-30) name ARTEX, HexStrike and CAIRN in incident-response engagements, and PentAGI in the wild (mostly scanning, some intrusions); they note local and self-hosted models as an attacker trend. Anthropic's September 2026 report names PentAGI; Check Point reported HexStrike forum chatter, no confirmed attacks | An open agent with local models and offensive tooling resembles these frameworks. No report mentions a desktop agent or per-tab Tor browsing |
| NIS2 supply chain | Italian MSPs are NIS2 entities and must vet their suppliers (D.Lgs. 138/2024, Art. 21(2)(d); decree text not checked) | No MSP pilot before signed builds and a published security policy |

What it means for Kucedr: defensive work is lawful and within the providers' policies. Marketing for
offensive use is the largest risk found in this search.

## All candidates ranked

Three judges scored each candidate 1 to 5; averages shown. Higher is better on every column: 5 means
strong demand, cheap to build, weak competition or low risk. Order follows the judges' majority
ranking, not the sum.

| # | Candidate | Demand | Pay | Edge | Build | Comp. | Mission | Importance | Risk | Sum | Fatal flaw |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hostile-content triage desk | 3 | 2 | 4 | 4 | 3 | 5 | 4 | 4 | 29.0 | Analysts pay remote sandboxes so hostile pages never render locally; Kucedr renders them in its own Electron process, and the safe version may be a thin layer over urlscan, which has a free API tier, with no proven payer |
| 2 | At-risk desk (grant-funded) | 2 | 2.7 | 3.3 | 2.3 | 4 | 5 | 5 | 2.7 | 27.0 | Its trusted bodies reject AI agents as privacy tools; an unsigned single-maintainer agent could hurt the people it serves; grants do not pay maintenance |
| 3 | Vulnerability-report triage | 3 | 1 | 2 | 2 | 3 | 4 | 4.3 | 4 | 23.3 | No payer; labs give maintainers free hosted scanning with stronger models |
| 4 | Prompt-injection bench | 2 | 1 | 3 | 3.7 | 3 | 4 | 3 | 4 | 23.7 | No funder; first results would mostly show Kucedr's own gaps and weak uncensored models |
| 5 | Scope-locked pentest workbench | 3 | 2 | 2 | 2 | 1 | 2 | 3 | 1 | 16.0 | Burp AT (public beta) already keeps scope in Burp; the sandbox would have to be loosened; documented misuse profile |
| 6 | Pre-filing R&D desk | 1.7 | 1 | 2.3 | 3 | 2 | 4 | 2.7 | 5 | 21.7 | No source shows anyone paying for local research AI; indexing is not local today |

One judge put the bench third. The pre-filing desk sums above the workbench mainly on risk (5 vs 1)
and mission (4 vs 2); all three judges still ranked it last. Row 1 is scored as a candidate; the
evidence below makes it a feature of direction 2.

## The hostile-link feature in detail

**Who.** Freelance and small-team CTI and trust-and-safety analysts, due-diligence investigators,
newsroom security desks. IT staff at small MSPs only after signed builds (see the NIS2 row above).
Not SOCs.

**Jobs.**

1. If the user has picked a service for the case, send the URL or hash to urlscan, VirusTotal or
   ANY.RUN and show the verdict and screenshot.
2. Only if the user chooses, open it in a Tor or proxy tab that cannot fall back or reach the LAN.
3. Keep any download held and hashed, never released by accident.
4. Have a local model summarise the page when the content is confidential.
5. Produce a short incident note with captures and hashes.

**Product rules.**

1. Defensive only. No offensive modules, no evasion features, no safeguard bypass.
2. Remote detonation only when the user picks the service for the case. The app sends urlscan scans
   as private, since a public scan can be seen by others, and says that files sent to VirusTotal
   are shared with its partners. Local viewing is the exception and says so.
3. Never "anonymous". Say Kucedr is not Tor Browser: beyond removing the Electron and app tokens
   from the user agent, it does nothing about fingerprinting.
4. Say plainly that page text reaches a hosted model unless a local one is used.
5. A human writes the conclusion; the agent collects and suggests.

**What exists and what is missing.**

| Need | Today | Missing | Size |
| --- | --- | --- | --- |
| Route proof | Routes with no fallback | Real-Tor and real-proxy test with host packet capture ([TOR.md](../roadmap/TOR.md)) | S |
| Safe downloads | Held, never from Tor | SHA-256 and quarantine flag | S |
| Remote detonation | MCP and plugin manifests | urlscan, VirusTotal, ANY.RUN connectors as manifests | S each |
| Current engine | Electron 44.4.5 | Update to current 44.x, as a standing release duty | S |
| Direct-tab safety | Name-based local block | DNS-rebinding check ([SHIELD.md](../roadmap/SHIELD.md)) | S to M |
| MCP trust | Hash pinning | Close the `readOnlyHint` auto-allow; alert on change | S |
| Hostile text | Web, search and connector results unmarked; one system-prompt line (knowledge excerpts are already labelled untrusted) | Untrusted-content marking ([13.10](../roadmap/SHIELD.md)) | M |
| Evidence | Screenshot, PDF | Capture record bound to bytes, URL, time, hash and case; incident-note export | M |
| Case separation | Files-only workspace plan | Workspace per case, including its own chats and memory, which [WORKSPACES.md](../roadmap/WORKSPACES.md) leaves open | M to L |
| Phishing screenshots | Images not shown to model | Image input ([COMPUTER.md](../roadmap/COMPUTER.md)) | M |
| Trust the installer | Unsigned | Signed and notarised builds ([6.1](../roadmap/DISTRIBUTION.md)); close High audit items | L (paid certificates), plus the audit items |

**How it is funded.** Nothing found funds the triage desk itself. Grants can fund the trust work
every direction needs: an NLnet proposal by 2027-01-03 for route enforcement with no fallback as a
reusable library, and only if it is written by hand. HRF funds tools for people under authoritarian
rule, and its own page says agents should not be given sensitive information, so an HRF application
should be for the locked-down local-only mode and the route library, not for the agent. SECURE Open
Call 2 (EU Digital Europe, secure4sme.eu; up to €30,000 at 50%, deadline 2026-12-11, secondary)
only if the owner already has a single legal entity that meets the EU SME definition. The desk pays
only if the demand gate shows prepayment.

### First test

Run this after the DIRECTIONS.md three-week buyer test, not alongside it. During that test, ask the
five due-diligence firms and five analysts about link triage. Nothing below adds a separate buyer
test before direction 2 passes.

1. **Technical gate (serves every direction).** With a local model, updates off and only routed
   tabs open, capture the host's traffic while five tabs load through a real Tor and a real proxy.
   Pass only if Kucedr's own process makes no DNS query and no TCP or UDP connection except to the
   Tor SOCKS port or the configured proxy port, and the target hosts appear only inside Tor or proxy
   traffic. Run it on macOS and Windows.
2. **Build only the Electron update and the `readOnlyHint` fix**, which serve every direction.
   Hashing and the urlscan connector wait for a pass of step 3.
3. **Demand gate, five weeks, only if direction 2 passes.** Only on a build with the current
   Electron 44.x release; shipping every Electron security release is a standing duty one
   maintainer has to budget for. Five analysts each triage ten URLs from their own queue. Pass only
   if at least two of them, or their employers, prepay three months at a stated €29 a seat
   (borrowed from DIRECTIONS.md, not evidence), after the lawyer check on the CRA. Weekly use
   without payment counts as evidence for the direction 2 feature, not as a pass. Fail if they keep
   their VM workflow or say urlscan's free tier or web UI already does the job. Italian MSPs come in
   only after signed builds and a published security policy.

## How it relates to MISSION.md, PRODUCT.md and DIRECTIONS.md

- **[MISSION.md](MISSION.md).** Unchanged and confirmed. The triage desk uses the kept protections
  as the product. Reading (a), no content rules from the app, causes no trouble in defensive work.
  The phase 1 work (signing, 13.10, sandbox egress) is the same work this direction needs first.
  What changes: "no content rules" needs one more line, that it never means helping bypass provider
  safeguards. Remote detonation is a recipient the user chooses for each case, never a default, so
  the "Private" promise holds.
- **[PRODUCT.md](PRODUCT.md).** The investigation desk's rules 1 to 5 (evidence, record, protect the
  investigator, local first, human concludes) fit the triage desk as written. Rule 6 is handled as
  MISSION.md recommends. "Never anonymous" stays.
- **[DIRECTIONS.md](DIRECTIONS.md).** This changes nothing in the DIRECTIONS.md order. The studio
  and due-diligence tests run first. This search adds one feature to direction 2, since both need
  the capture record and case workspaces. "Privacy alone does not sell" holds here too: no market
  showed a premium for local processing.

## Open decisions

- **Position Kucedr for "hacking".** Recommended: no, in any wording. Say "safe handling of hostile
  content" instead.
- **Triage desk as a direction or a feature.** Recommended: a feature of direction 2, unless the
  interviews and the demand gate show prepayment.
- **Grants.** Recommended: write the NLnet application by hand before 2027-01-03 for the route
  library; aim any HRF application at the local-only mode and the route library, not the agent;
  skip SECURE unless an SME entity already exists.
- **At-risk users.** Recommended: no outreach until builds are signed, items #2, #3 and #6 are fixed
  and #1 is decided, all re-checked in code because the audit table is out of date, and a threat
  model states what Kucedr does not protect against. Stop the at-risk desk if trainers say they
  would never hand an AI agent to their users.
- **Prompt-injection bench.** Recommended: build it as the 13.10 regression suite; publish only
  after 13.10 and the read-only fix.
- **Engagement scope.** Recommended: not now. Limit sandbox egress as a protection first
  ([21.10](../roadmap/SECURITY.md), [13.4](../roadmap/SHIELD.md)).
- **Legal check.** Recommended: one hour with an Italian criminal-law lawyer before the README or
  landing page carries the MISSION.md line (no content rules, uncensored local models, Tor). Ask
  about arts. 615-quater and 635-quater.1 for a general agent with Tor and no content rules, how far
  the MIT disclaimer holds under Italian law, and whether a prepaid pilot makes the owner a CRA
  manufacturer.
- **Paid tier.** Recommended: none for now. A prepaid pilot is charging; take no money before the
  lawyer has answered the CRA question.

## Not verified

- Nothing was run. No local model has used tools or the browser in Kucedr; no Tor tab has met a real
  Tor; no security tool (nmap, ffuf, nuclei) was run in the sandbox; Burp MCP and proxy chaining are
  untested.
- No source shows anyone paying for a local AI triage desk, a local research desk or scope
  enforcement. Every money figure belongs to adjacent incumbents or grant programmes.
- Italian law was read on Brocardi and in trade press, not the Gazzetta Ufficiale. The ACN CVD
  policy itself, the FBI ARTEX alert and the EU Living Guidelines (fourth version, October 2026)
  were not read.
- Grant fit is inferred: most HRF grantees are Bitcoin, Nostr or NGO projects; NLnet favours
  components. Sole-trader eligibility for SECURE is unverified.
- The "gap" for at-risk users rests on checking Tor Browser, Dangerzone, MVT, HRF's list, Robin and
  Hunchly; Tails, Qubes, Signal and Hush Line were not checked.
- Whether uncensored local models are more open to prompt injection was not measured.
- Burp's billing period, Caido's 2026 price, the Gartner AI SOC claims and the Italian NIS2 entity
  counts are unconfirmed. The NIS2 duty of Italian MSPs to vet suppliers was not checked against
  the text of D.Lgs. 138/2024.
- When CRA stewards' reporting duty starts (11 September 2026 or 11 December 2027) was not confirmed
  on a primary page.
- Whether an enrolled organisation's own API key keeps its CVP tier inside an open-source client is
  not stated by Anthropic.
- CTF, training and red-team tooling were not researched as markets. EU dual-use controls on
  intrusion software (Reg. 2021/821) were not checked; publicly available open source is generally
  outside them. GDPR roles for a pilot that handles reported emails were not checked.

## Sources

Read 2026-11-26.

- Code: `src/main/agent/sandbox.ts`, `src/main/agent/tools/web/browser/{prepare,create,hold}.ts`, `src/main/agent/tools/web/use_web_browser.ts`, `src/main/shield/{verdict,local}.ts`, `src/main/mcp/{mcp_tool_permission,mcp_client_build_transport,url}.ts`, `src/main/privacy/state.ts`, `src/main/agent/runner/run_tool_call.ts`, `src/main/coding/harness/protocols.ts`, `src/main/agent/tools/knowledge/query_knowledge.ts`, `resources/plugins/openai/models/`, `electron-builder.json`, `node_modules/@anthropic-ai/sandbox-runtime/README.md`
- Offensive: https://portswigger.net/burp/pro · https://portswigger.net/burp/burp-at · https://www.caido.io/blog/2025-08-21-localized-pricing/ · https://github.com/usestrix/strix · https://docs.strix.ai/llm-providers/local · https://github.com/KeygraphHQ/shannon · https://xbow.com/news/xbow-raises-120m-to-scale · https://horizon3.ai/news/press-release/horizon3-raises-250m-series-e-at-2b-valuation-to-lead-the-ai-vs-ai-cybersecurity-era/ · https://www.hackerone.com/press-release/hackerone-report-reveals-growing-exposure-debt-vulnerability-backlogs-grew-131-even · https://www.bugcrowd.com/blog/inside-the-mind-of-a-hacker-2026/ · https://www.kali.org/tools/mcp-kali-server/
- Defensive: https://urlscan.io/pricing/ · https://www.hunch.ly/pricing · https://www.microsoft.com/en-us/security/pricing/microsoft-security-copilot/ · https://go.crowdstrike.com/charlotte-ai-50-free-credits.html · https://torq.io/news/torq-seriesD/ · https://aws.amazon.com/marketplace/pp/prodview-vfaxq4ygumtqs · https://www.diritto.it/nis2-2026-guida-operativa-prossimi-passi-imprese-pa/ (secondary) · https://support.torproject.org/tbb/tbb-9/ · https://releases.electronjs.org/release/v44.4.5
- Vulnerability research: https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/ · https://anthropic.com/research/launching-opt-in-vuln-finding-service-for-open-source · https://red.anthropic.com/2026/cvd/ · https://www.anthropic.com/news/claude-code-security · https://openai.com/index/scaling-trusted-access-for-cyber-defense/ · https://www.anthropic.com/news/expanding-project-glasswing · https://zeropath.com/pricing · https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- Science: https://elicit.com/pricing · https://www.undermind.ai/pricing · https://consensus.app/home/blog/30m-in-new-funding-to-reach-the-next-10m-researchers/ · https://openai.com/index/introducing-prism/ · https://help.openai.com/en/articles/20001406-chatgpt-for-academic-researchers · https://arxiv.org/html/2606.03248 · https://www.unifg.it/sites/default/files/2025-10/08-dpunto-08-CA24set2025-contratto-chatGPTedu-prot.pdf · https://it.polito.it/en/communications/activation-of-the-chatgpt-edu-service-for-faculty-and-staff
- At risk and funding: https://hrf.org/program/ai-for-individual-rights/ai-for-individual-rights-fund/ · https://hrf.org/program/ai-for-individual-rights/ai-grants/ · https://hrf.org/ai · https://www.opentech.fund/funds/internet-freedom-fund/ · https://clearinghouse.net/case/46258/ (secondary) · https://nlnet.nl/propose/ · https://nlnet.nl/news/2026/20260612-NGIZero-stocktaking.html · https://www.sovereign.tech/programs/fund · https://news.internetsociety.org/?p=39115 · https://www.cyberresilienceact.eu/news/secure-second-open-call-1-october-2026-cra-sme-funding.html (secondary) · https://dangerzone.rocks/ · https://github.com/mvt-project/mvt · https://blog.torproject.org/new-release-tor-browser-150/ · https://techcrunch.com/2026/03/05/italian-prosecutors-confirm-journalist-was-hacked-with-paragon-spyware/ (secondary) · https://github.com/apurvsinghgautam/robin
- Legal and platform: https://www.brocardi.it/codice-penale/libro-secondo/titolo-xii/capo-iii/sezione-iv/art615ter.html · https://www.brocardi.it/codice-penale/libro-secondo/titolo-xii/capo-iii/sezione-iv/art615quater.html · https://www.brocardi.it/codice-penale/libro-secondo/titolo-xiii/capo-i/art635quater1.html · https://www.ictsecuritymagazine.com/articoli/cvd-hacker-etici-615-ter/ (secondary) · https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act · https://digital-strategy.ec.europa.eu/en/policies/cra-open-source · https://artificialintelligenceact.eu/article/2/ (secondary) · https://www.cuatrecasas.com/en/portugal/intellectual-property/art/digital-omnibus-ai-has-been-published (secondary) · https://www.anthropic.com/legal/aup · https://support.claude.com/articles/14604842-real-time-cyber-safeguards-on-claude · https://openai.com/policies/usage-policies/ · https://help.openai.com/en/articles/20001259 · https://cloud.google.com/blog/topics/threat-intelligence/artex-and-friends-enter-agentic-offensive-frameworks · https://www.anthropic.com/threat-intelligence-report-september-2026 · https://blog.checkpoint.com/executive-insights/hexstrike-ai-when-llms-meet-zero-day-exploitation/
- Agent security: https://www.anthropic.com/research/prompt-injection-defenses · https://openai.com/index/hardening-atlas-against-prompt-injection · https://openai.com/index/openai-to-acquire-promptfoo/ · https://www.csoonline.com/article/4244500/crowdstrike-to-acquire-fiddler-dreadnode-to-extend-ai-security-across-agent-lifecycle.html (secondary) · https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-security-crisis-20260504/ · https://github.com/luckyPipewrench/pipelock · https://github.com/NVIDIA/garak · https://github.com/cisco-ai-defense/mcp-scanner
- Power users: GitHub REST API star counts, 2026-11-26 · https://proton.me/lumo/pricing · https://techcrunch.com/2026/01/18/moxie-marlinspike-has-a-privacy-conscious-alternative-to-chatgpt (secondary)
