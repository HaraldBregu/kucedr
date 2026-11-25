# Hyperresearch

Research note for the [company-brief direction](RESEARCH.md). Read 2026-11-25 from the sources at the end.
"Not stated" means the pages read did not say.

## At a glance

- **Company:** Hyperresearch. Legal entity and location not stated; the footer reads "© 2026
  Hyperresearch".
- **People:** the footer links a founder page for Jordan Gibbs.
- **Product:** a hosted deep-research service that returns "a rigorously cited research report",
  with a REST API and a remote MCP server. The same pipeline is open source (MIT, about 5,100 GitHub
  stars) and runs inside Claude Code or Codex.
- **Customers:** deal teams and advisors, private equity, consultants and market research; its due-
  diligence page also addresses small-business buyers. Uses listed include "due diligence,
  competitor analysis, regulatory questions and go/no-go decisions".

## Mission

No mission statement. The home page says "Ask a question and get a rigorously cited research
report".

## What they sell

- **Light run:** one focused question, "about 20 to 50 sources in about 30 to 40 minutes", about
  2,500 to 4,000 words.
- **Deep run:** a full profile in 3 to 5 chapters, targeting 150 to 200 sources over 3 to 5 hours;
  the page calls these targets, not guarantees.
- **Answers:** "one question, one checked answer for your agent", billed per call.
- **Workspace vault:** every source, interim note and claim from a run, searched before the web on
  the next run about the same target.
- **Open-source CLI:** `pip install hyperresearch`, run from Claude Code or Codex, writing a vault of
  Markdown notes and a `final_report.md`.

## Prices

From the pricing page, in US dollars:

- **Pay as you go:** $0 a month, the default; runs charged on one monthly invoice, with an optional
  spend cap. No minimum and no seat licence.
- **Light:** $9 per run.
- **Deep:** $49 per run.
- **Reruns:** 25% of the run price from step 12 onward, 50% from steps 8 to 11, full price from
  steps 2 to 7.
- **Free:** the first Light report, once per account, no card.
- **Answers:** prepaid wallet with $5 of starting credit and top-ups of at least $10; the per-call
  price is on a separate page not read.
- **Enterprise:** for retention or residency terms; price not stated.

## Evidence and AI

- Every run includes the full list of sources read and where each came from, and "a table of the
  claims the report relies on, with the quote behind each".
- Light runs check cited claims against their sources and correct what fails; Deep runs add a
  verification receipt recording which citations were read back.
- The vault keeps full text, raw PDFs, reports and run artefacts; each note records when it was
  fetched, the provider that fetched it, any DOI and the run. HTML copies, screenshots and hashes
  are not stated.
- Retention: "Nothing ages out by itself today". Pay-as-you-go exports leave out raw files older
  than 180 days and model-call logs older than 30 days, without deleting them.
- Export: the vault as a tar.gz in the CLI's layout; the hosted report's file format is not stated.
- Workspaces are separate: "no query spans workspaces". Hosting location not stated.
- Sources: public pages read logged out; it does not read PitchBook or Crunchbase. It "gathers and
  checks sources; it does not give legal or investment advice".
- Models: the open-source version "runs on Anthropic models" in Claude Code; the hosted service's
  models are not stated.

## Compared with Kucedr's direction

- The cheapest AI-drafted, source-checked company profile found: $9 or $49 per run, with a claim and
  quote table close to the reviewer view the research asks for.
- It keeps the text it read, not a capture of the page as the analyst saw it, on the pages read.
  It drafts research reports, not the firm's client brief in its own template.
- The MIT pipeline in Claude Code or Codex shows that a technical analyst can assemble the agent and
  source vault for the cost of a model subscription. Kucedr's difference has to be capture, review
  and export, not drafting alone.

## Sources

- [Hyperresearch](https://hyperresearch.ai/), [pricing](https://hyperresearch.ai/pricing), [AI due diligence](https://hyperresearch.ai/ai-due-diligence) and [vault](https://hyperresearch.ai/vault), Hyperresearch
- [hyperresearch on GitHub](https://github.com/jordan-gibbs/hyperresearch), Jordan Gibbs (MIT licence)
