# How Kucedr competes

Who else serves the analyst and reviewer in the [company-brief direction](RESEARCH.md), what they
charge, what each one does on the reviewer test, and where Kucedr can still win. Read on
25 November 2026. Each competitor has a research note in this folder with its sources; margins and
plan arithmetic are in [Margins and unit economics](ECONOMICS.md).

## Summary

- **DeepState already sells most of the product direction's pitch.** It is a desktop app for
  Windows, macOS and Linux whose agent browses, captures pages as MHTML and PNG into a SHA-256
  hash-chained log, and writes a PDF dossier whose AI text cites numbered exhibits. It runs on the
  user's own Anthropic, OpenAI or OpenRouter key or on Ollama. It costs $29 a seat a month with
  the user's own key and $49 with managed AI. The [product direction's](PRODUCT.md#2-what-the-market-says)
  statement that no tool is a local AI desk no longer holds. [DeepState](companies/DEEPSTATE.md)
- **AI drafting alone is a commodity.** Hyperresearch sells a cited company report for $9 or $49 a
  run, OpenDossier a company report for $49, NC Data one for €22.50, and Claude Pro includes
  Research for $20 a month. [Hyperresearch](companies/HYPERRESEARCH.md) · [OpenDossier](companies/OPENDOSSIER.md) ·
  [NC Data](companies/NCDATA.md)
- **The opening left is the reviewer handoff inside the firm's own deliverable.** No product read
  does all of: keep the page as the analyst saw it, link one sentence of an editable brief to the
  exact passage, let a reviewer approve or correct that sentence, and export the brief in the firm's
  format with its sources so the link survives. DeepState stops at a PDF snapshot, Casefleet has no
  web capture, and the AI report services keep text or links rather than captures.
- **Price against DeepState, not against Maltego or Videris.** A paid seat near $49 a month has to
  show the handoff working; below that, Kucedr's free open-source core with the user's own keys
  already undercuts DeepState's $29 plan.

## The field

| Segment | Products and published prices | What they own | Gap for Kucedr |
| --- | --- | --- | --- |
| Local AI investigation desk | [DeepState](companies/DEEPSTATE.md): $29 a seat a month (own key), $49 (managed AI). [OSIRT](companies/OSIRT.md): local investigation browser, no AI stated, prices not public | Agent, capture, hash chain and dossier on the analyst's machine | Editable brief in the firm's template; per-sentence review |
| Cloud AI investigation agents | [Nexus](companies/NEXUS.md): €119 to €219 a month. [OSINT Pilot](companies/OSINT_PILOT.md): about $13 to $20 an investigation. [AegisStack](companies/AEGISSTACK.md): not published. [OpenOSINT](companies/OPENOSINT.md): free MIT, plans €300 to €1,000 a year | Multi-step agents over many OSINT tools; Nexus has a hash-chained custody trail | Local data and the user's model; company briefs rather than OSINT on people |
| AI-drafted company reports | [Xapien](companies/XAPIEN.md): from 250 reports a year, price not published. [Hyperresearch](companies/HYPERRESEARCH.md): $9 or $49 a run. [OpenDossier](companies/OPENDOSSIER.md): $49 report, $99 to $149 a seat a month, analyst brief from $1,000. [NC Data](companies/NCDATA.md): €22.50 a report, €59.90 a month | Fast cited drafts, licensed data, sentence-level sourcing (Xapien), per-claim status (OpenDossier) | No preserved page capture stated in any of them; output is their report, not the firm's |
| Evidence capture | [Hunchly](companies/MALTEGO.md): €149 a year. [Forensic OSINT](companies/FORENSIC_OSINT.md): $197 to $1,097 a year. [Bellingcat Auto Archiver](companies/BELLINGCAT.md): free | Timestamps, hashes, MHTML, WACZ, signed PDFs | No agent, no drafting, no review |
| Institutional platforms | [Maltego](companies/MALTEGO.md): €3,000 to €7,500 a year. [Videris](companies/VIDERIS.md): £30,000 a year for four users. [Authentic8 Silo](companies/AUTHENTIC8.md): $1,450 to $3,450 a user a year | Data catalogues, managed attribution, audit trails, certifications | Priced and sold for banks, government and large firms |
| AI case review | [Casefleet](companies/CASEFLEET.md): $140 a user a month | AI proposes a cited fact, a person approves it, Word export links each citation to its file | Litigation only, uploaded documents only, cloud |
| Do it yourself | Word and Zotero (free); Claude Pro $20 a month with Research; ChatGPT Plus $20 a month with deep research | The firm's templates, habits and existing citations | Nothing joins capture, drafting and review |

## The reviewer test, product by product

The decisive scenario from the [commercial research](RESEARCH.md#the-first-client-brief): a week
after delivery, the supplier's page has changed, and a reviewer questions one sentence. What each
product's pages say it can do:

| Product | Keeps the page as the analyst saw it | Sentence linked to its source | Reviewer approves or corrects a claim | Editable export in the firm's format | Local, own model |
| --- | --- | --- | --- | --- | --- |
| DeepState | Yes: MHTML, PNG, SHA-256 hash chain | Yes: `[E-03]` exhibit links in AI text | Not stated | No: PDF dossier only | Yes |
| Casefleet | No: uploaded files only | Yes: citations to files | Yes: approve, edit or reject | Yes: Word with linked files in a zip | No |
| Videris | Yes: "evidential source capture" and audit trail; hashes not stated | "Fully sourced" reports | Yes: "human-reviewable reports" | PDF, Word, CSV | No |
| Xapien | Not stated | Yes: down to sentence level | Not stated | No: PDF and share links | No |
| OpenDossier | Not stated | Yes: per-claim evidence chain | Its own analysts review | No: PDF, CSV, JSON, Markdown | No |
| NC Data | No web capture described | Page-level citations for PDFs | Yes: accept or reject each finding | PDF and evidence packs | Browser-local; models via OpenRouter |
| Hyperresearch | Full text and PDFs, not page captures | Claim-and-quote table | Automated citation check | Not stated | Open-source version in Claude Code |
| Hunchly, Forensic OSINT | Yes, with hashes | No drafting | No | Forensic OSINT: signed PDF | Local |
| **Kucedr today** | Partly: screenshot and PDF files, without a record binding address, time and hash | Relative links to files, lost on export | No | Markdown, HTML, PDF; a DOCX skill | Yes |

Kucedr's row comes from the [software assessment](SOFTWARE.md#verification-performed). Two
products come closest from opposite sides: DeepState has the capture and the local agent but not
the editable, reviewable brief; Casefleet has the review and the Word export but not the capture or
the local deployment. Videris has most of it at £30,000 a year.

## Where Kucedr should not compete

- **Data.** Maltego, Videris, Xapien and OpenDossier license corporate and risk data. Kucedr has
  none and should take the firm's own sources and registry extracts as input.
- **Hiding the investigator.** Authentic8 owns managed attribution with 700+ exit points in 32+
  countries. Kucedr's Tor and proxy tabs should not be sold against it.
- **Court-grade claims.** Forensic OSINT, Nexus and DeepState already sell hashes and custody
  trails; Nexus itself says a hash does not establish admissibility. Kucedr's records should match
  their fields without promising more.
- **Finished reports.** OpenDossier and NC Data sell the report itself from $49 and €22.50. Kucedr
  sells to the firm that writes the bespoke brief, not to its client.
- **Drafting speed.** Hyperresearch at $9 a run and a $20 chat subscription set the price of a
  cited draft. A faster draft is not a reason to switch.

## Where Kucedr can win

1. **Review inside the brief.** The reviewer opens the firm's own editable brief, clicks a sentence,
   sees the preserved passage beside it, and approves, narrows or rejects the wording. The decision
   and the qualification stay with the sentence. Casefleet shows lawyers pay $140 a month for this
   loop on uploaded documents; nobody read offers it on captured web pages and filings.
2. **A brief that travels.** Export the brief with its preserved sources and a manifest of hashes
   and capture times, so a reviewer or client can check it without Kucedr installed. DeepState's
   export zip proves the evidence log can travel; the brief itself has to travel with it, in Word
   when the client requires it.
3. **The exact place, not the page.** A paragraph in a captured page, a page in a filing, a cell in
   a workbook. The software assessment found the spreadsheet cell is lost today; competitors cite at
   page level (NC Data) or sentence level without a saved copy (Xapien).
4. **Open source and the user's own model.** DeepState matches local storage and model choice, so
   this is parity, not a lead. The MIT licence is the difference that can be checked: a firm can
   audit what touches client material, and the core costs nothing with the firm's own keys.
5. **Italy and the UK first.** The founder can sell to Italian investigative agencies in their own
   language, and the [commercial research](RESEARCH.md#a-public-example-anyone-can-check) already
   has demo cases built on Registro Imprese and UK sources. NC Data covers the same two countries
   for standard reports; OpenDossier covers neither yet.

## How to compete

**Positioning.** "Briefs your reviewer can check": for boutique due-diligence firms that deliver
bespoke company and supplier briefs and have a second person read them before they go out.

**Price.** Grounded in [the unit economics](ECONOMICS.md):

| Offer | Price to test | Anchor |
| --- | --- | --- |
| Open-source core, own keys | Free | DeepState Personal $29 a month; Claude Pro $20 |
| Firm seat with hosted model and search, capped allowance, review and export | €45 to €49 a seat a month | DeepState Professional $49; NC Data Premium Plus €59.90; Casefleet $140; Nexus €119 |
| Per brief for occasional users | €29 a brief | Hyperresearch Deep $49; OpenDossier report $49 |
| Assisted pilot: setup, one template, two briefs | €500 | Four hours of founder time; €250 loses money |

A seat above DeepState's $49 needs the reviewer handoff demonstrably working. Without it, the
honest price is the free core plus credits.

**Channel.** Founder-led sales to firms: the Association of British Investigators directory in the
UK and Italian investigative agencies directly, as the [pilot plan](RESEARCH.md#who-to-recruit-and-what-to-measure)
describes. The open-source project, a listing in Bellingcat's toolkit and free plans for non-profit
newsrooms build the reputation, not the revenue: individual seats cannot carry paid acquisition
(see [churn and acquisition](ECONOMICS.md#churn-acquisition-and-the-funnel)).

**Proof.** Publish the public MINI Oxford–Swindon case with its answer key and run it in Kucedr,
DeepState and the firm's usual Word-and-Zotero workflow. Time the reviewer on the changed-page
exercise. A comparison a buyer can rerun is worth more than any feature list.

## Threats

| Threat | Likelihood | Response |
| --- | --- | --- |
| DeepState adds Word export and per-sentence review | High: the evidence log and exhibit links are already built | Ship the handoff first; compete on the open-source core, the firm's template and passage-level links |
| Model vendors add page capture to their research modes | Medium | Use their models; the firm's template, review and preserved evidence stay in Kucedr |
| Report services fall further in price | High | Sell to the firm writing the bespoke brief, not to its client |
| Hosted usage outruns the seat price | Medium | Capped allowance and credits; Haiku-class models by default ([hosted plan](ECONOMICS.md#hosted-kucedr-pays-for-the-model-and-search)) |
| Firms keep Word and Zotero | High | Deliver into Word; ask for one brief, not a workflow change |

The moat is thin. An open-source core can be copied, and DeepState is a few features away from the
same promise. What lasts is what a firm builds on Kucedr: its templates, its reviewers' habits and
a record of briefs that held up. Speed to the first five paying firms matters more than breadth.
