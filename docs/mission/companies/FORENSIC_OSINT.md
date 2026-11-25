# Forensic OSINT

Research note for the [product direction](../PRODUCT.md). Read 2026-11-25 from the sources at the end.
"Not stated" means the pages read did not say.

## At a glance

- **Company:** the site's footer reads "© 2026 TwiceSafe Software Solutions Inc.". Headquarters,
  founding year and founders are not stated.
- **Product:** a Chrome extension for full-page web capture, with signed reports.
- **Users (claimed):** "10,000+ weekly active investigators".
- **Customers:** law enforcement, criminal and civil investigators, corporate investigation teams,
  journalists and legal professionals.

## Mission

> "Our focus: preserve what an investigator actually observed online so it can be explained,
> defended, and relied upon in court."

## What they sell

- **The extension:** full-page capture "one screen at a time", video downloads and digitally
  signed PDF reports.
- **ELITE extras:** Subject Dossier, team sync and advanced captures.
- **Assisted capture:** help capturing whole websites and Facebook timelines.
- **Forensic Notes:** add-ons for case notes.
- **Hosting:** a managed Azure cloud in the USA, single-tenant hosting as an add-on, or on-premise.
- **Training:** professional OSINT courses; prices not stated.

## Prices

In US dollars, from the pricing pages:

- **Free (Community Edition):** 100 captures a year, 3 video downloads a year, 4 scrolls per
  capture, video up to 1080p.
- **Essential:** $197 a year. Unlimited captures, 50 video downloads a year, 20 scrolls.
- **ELITE:** $1,097 per user a year. Unlimited captures and videos, 500 scrolls, video up to 4K.
- **ELITE Assisted Capture:** not priced on the pricing page. Its own page listed $1,699 a year as
  an introductory price until 31 October 2026, then $2,097 a year.
- **Lifetime offer:** Essential $597 and ELITE $3,497, one-time, until 30 November 2026.
- **Teams:** team features need a minimum number of ELITE licences. Buying five or more ELITE
  plans adds a year of single-tenant hosting, renewed at $999 a year; further discounts from 20
  licences.

## Evidence and AI

- Each capture is timestamped by the Forensic OSINT system and "protected against later
  alteration". "All captured artifacts are hashed"; SHA-256 is named for video continuity reports.
- Page source is kept as MHTML; reports are digitally signed PDFs.
- No managed attribution: capture runs in the investigator's own Chrome.
- AI integration: "Coming Winter 2026".

## Compared with Kucedr's direction

- Forensic OSINT sells the evidence piece Kucedr lacks today: timestamps, hashes, MHTML and signed
  reports, in court-oriented language. It has no agent yet.
- Its Essential plan at $197 a year sets the price investigators expect for capture alone.
- Room for Kucedr: capture records with the same fields as part of an agent that also searches,
  verifies and writes the report. Avoid its "relied upon in court" wording until the records are
  proven (see the product direction's risks).

## Sources

- [Home](https://www.forensicosint.com/), [pricing](https://www.forensicosint.com/pricing), [download](https://www.forensicosint.com/download) and [about](https://www.forensicosint.com/about-us), Forensic OSINT
- [ELITE team bundle](https://www.forensicosint.com/bogo) and [Elite Assisted Capture](https://www.forensicosint.com/elite-assisted-capture), Forensic OSINT
- [Hunchly vs Forensic OSINT](https://www.forensicosint.com/hunchly-vs-forensic-osint), vendor comparison
