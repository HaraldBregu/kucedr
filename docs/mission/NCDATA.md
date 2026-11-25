# NC Data

Research note for the [company-brief direction](RESEARCH.md). Read 2026-11-25 from the sources at the end.
"Not stated" means the pages read did not say.

## At a glance

- **Company:** NC Data, developed by Nurnberg Consulting SL, Madrid, Spain. Founding year not stated;
  the about page cites "more than 25 years" of corporate intelligence experience and client
  advising "Since 2013".
- **People:** Alessandro Nurnberg (founder and lead consultant) and William Lee (partner and
  business intelligence specialist).
- **Product:** "Intelligence for analysts and companies": company research, document review,
  evidence extraction, sanctions screening and report production in one workspace, plus one-off
  due-diligence reports.
- **Customers:** compliance, KYC and AML teams; investigators and due-diligence analysts; public
  affairs teams; corporate teams needing repeatable research.
- **Coverage:** reports cover the UK (Companies House), France, Switzerland, Spain (BORME) and Italy
  (Registro Imprese). Other sources include the BOE, Belgian registries, sanctions lists, ICIJ
  Offshore Leaks, the EU Transparency Register and IOSCO warnings in "90+ jurisdictions".

## Mission

> "At NC Data, we are on a mission to help our clients gather, analyze and optimally apply corporate
> intelligence." (about page)

## What they sell

- **Due-diligence reports:** registry profile, directors and officers, sanctions screening with
  potential matches "flagged for human review", and risk indicators, as a PDF. No account needed.
  Each report includes free monitoring with email alerts for BORME events and IOSCO warnings.
- **Workspace:** Document Canvas, Case Manager, entity resolution, timeline and findings; evidence
  extraction from documents, where "The analyst validates, edits or rejects the finding"; evidence
  packs, timelines and case notes built from approved findings.
- **Data services:** News API, sanctions screening, free company searches (UK, CH, B, F, LEI), the EU
  lobbies database, an IBEX35 dashboard and MCP server access.

## Prices

From the pricing page, in euros:

- **Due-diligence report:** €22.50 per report "plus IVA". The home page says "from EUR 22.50 + VAT"
  and also "21% IVA included in final price", so the final price is unclear. It adds that
  registered users "get the same DD reports at no extra cost, plus monitoring of up to 10
  companies".
- **Free:** €0; workspace, Case Manager, local browser storage and public registries. AI queries and
  paid registries are pay-as-you-go, with top-ups from €1.
- **Premium Plus:** €59.90 a month; custom model endpoints, larger quotas, 10 News API searches and 2
  sanctions screenings a month, priority support. VAT not stated.
- **Enterprise:** custom.
- **AI usage packages:** €1, €5, €10, €25, €45 and €85. Usage is billed at model cost plus a 39%
  service fee, which "also covers VAT costs"; credits do not expire. Examples per million tokens
  (input / output): Claude Sonnet 4.5 €4.17 / €20.85; Gemini 3 Flash €0.70 / €4.17.
- **Per search:** News API €0.50; sanctions screening €2.00; company searches and the EU lobbies
  database free.

## Evidence and AI

- Reports are "AI-assisted" and "source-backed"; the home page promises "full source citations" and
  "page-level citation provenance" for PDFs.
- Raw extraction is kept separate from approved findings, and evidence packs "preserve the record
  behind them".
- Web page capture: not described; "web material" is listed only as a document type it can ingest.
  Hashes: not mentioned.
- Storage: "your core workspace stays in your browser", and "only the specific chunks you query or
  approve for analysis are sent to an LLM". Some features use Cloudflare Workers and AI providers.
- Models: over 300 through OpenRouter, with full pricing in the app; custom endpoints on Premium
  Plus.

## Compared with Kucedr's direction

- NC Data is closest on price and on the reviewer step: a browser-local workspace where the analyst
  accepts, edits or rejects each AI-extracted finding with a page-level citation, plus €22.50
  standard reports for the UK and Italy used in the research's demo cases.
- It already offers model choice with a stated markup and keeps case material in the browser, which
  overlaps with Kucedr's local, own-model pitch.
- The pages read describe neither web page capture nor hashes, so the changed-website test is where
  Kucedr can differ. The research already treats its €22.50 report as the price anchor for a
  standard profile.

## Sources

- [NC Data](https://ncdata.eu/), [pricing](https://ncdata.eu/pricing), [due-diligence reports](https://ncdata.eu/due-diligence-reports) and [about us](https://ncdata.eu/about-us), Nurnberg Consulting SL
- [Document evidence extraction](https://ncdata.eu/document-evidence-extraction) and [company intelligence platform](https://ncdata.eu/company-intelligence-platform), NC Data
