# DeepState

Research note for the [company-brief direction](../RESEARCH.md). Read 2026-11-25 from the sources at the end.
"Not stated" means the pages read did not say.

## At a glance

- **Company:** not stated. The footer reads "© 2026 DeepState" and "Built in Canada"; no legal entity
  or city is given.
- **People:** not stated.
- **Product:** DeepState, a desktop investigation app for Windows, macOS (Intel and Apple silicon)
  and Linux. Cases are mapped as linked nodes on a canvas, and an AI assistant does the reading.
- **Customers:** OSINT analysts, investigative journalists and corporate security teams; plans are
  aimed at "Investigators running client cases" and "Teams, units and agencies".

## Mission

No mission statement. The headline is "Map the whole case on one canvas — and let the AI do the
reading."

## What they sell

- **Canvas:** 16 node types, including people and organisations, with timelines, narratives,
  full-text search and Wikipedia enrichment.
- **AI assistant:** creates and links nodes, searches open sources and captures findings, using 70+
  tools for the web, social platforms, court and SEC records, sanctions lists, blockchain data and
  geospatial sources. A plan mode proposes steps before changing anything, every tool call is shown,
  and changes can be undone.
- **Dossiers:** a typeset PDF built from the board, with an optional AI-written executive summary,
  key findings with confidence ratings, open questions and a note on sources.
- **Presentations:** slide decks the AI researches and designs, exported to PDF.
- **Cases and client record:** tasks, files, hours and boards per case; "sealed instructions,
  contacts, hours against budget"; CSV export of hours.
- **Sharing:** over the local network, an optional relay that sees only ciphertext, or a shared
  folder.

## Prices

From the pricing section, "per seat, billed monthly", in dollars (currency not named):

- **Personal:** $29 a month, for "Researchers, journalists and students"; AI assistant "using your
  own API key". The list shows both "Up to 5 boards" and "Unlimited boards".
- **Professional:** $49 a month; unlimited boards, cases and client record, the "Tamper-evident
  evidence log", "Lawful collection only mode", "Included DeepState managed AI usage" and priority
  support.
- **Enterprise:** $98 a month for 2 seats ($49 per seat); volume rates from 6 seats, "up to 40% off";
  over 50 seats or invoiced terms through sales.
- **Trial:** 14 days of "the full Professional edition", "No card". Annual billing not mentioned.

## Evidence and AI

- **Evidence log (Pro, Enterprise and trials):** pages the assistant opened are saved as MHTML,
  pages read without its browser as the HTML "exactly as received", plus PNG screenshots, downloads,
  Wayback Machine saves (archive link and time) and a JSON record of each assistant turn.
- Each entry records the address, page title, capture time, browser identity, DeepState version and
  the SHA-256 of each file. Pages over 50 MB are logged without keeping the file.
- "The log is a hash chain"; its head hash can be quoted in a report. The log re-checks every entry
  and file on each opening. The export zip includes the files, `SHA256SUMS`, JSON and CSV entry
  lists and a verification report.
- **Dossier citations:** entries are numbered exhibits (E-01, E-02); "Citations in the AI text such
  as `[E-03]` are links to the entry". A Sources section lists each URL with publisher, author,
  publication and capture dates and any archived copy. AI passages are marked as machine-generated,
  and the method appendix names the models.
- Dossiers are PDF only on the pages read (A4 or US Letter, with a handling marking), built from the
  board as it was at **Build PDF**.
- **Lawful collection only:** switches off "Instagram, Facebook, LinkedIn and people-search tools" and
  stops fetching paywalled articles from archive copies.
- **Storage and models:** a local SQLite database plus media folders; "Nothing is synchronised to
  us." Users can "Bring your own Anthropic, OpenAI, OpenRouter or OpenCode (Zen / Go) keys", use the
  DeepState managed service, "or run Ollama for an entirely offline deployment".

## Compared with Kucedr's direction

- The closest overlap with Kucedr in these notes: a local desktop app, an AI agent that browses and
  captures, a SHA-256 hash-chained capture log, the user's own model or Ollama, and a report whose
  AI claims link to numbered exhibits.
- As described, it covers much of the research's changed-website test: the reviewer can open the
  MHTML copy the assistant saw and check its hash.
- Gaps against the brief: the dossier is a PDF snapshot of the board, with no editable Word output
  in the firm's template on the pages read. Whether a reviewer can approve or correct one sentence
  and keep that link in the export is not stated.
- Price signal: $49 per seat a month for client cases with managed AI, or $29 with the user's own
  key. Kucedr would be priced against this, not against Videris.

## Sources

- [DeepState](https://getdeepstate.app/) (features, pricing, storage and AI providers)
- [Documentation](https://docs.getdeepstate.app), [dossiers](https://docs.getdeepstate.app/ai-assistant/dossiers) and [evidence log](https://docs.getdeepstate.app/data/evidence-log), DeepState
