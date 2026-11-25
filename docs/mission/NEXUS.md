# Nexus (Next Sight)

Research note for the [product direction](PRODUCT.md). Read 2026-11-25 from the sources at the end.
"Not stated" means the pages read did not say.

## At a glance

- **Company:** Next Sight d.o.o., Ljubljana, Slovenia (EU). Founding year not stated.
- **People:** co-founders Zvonimir Cvetko Damnjanović (CEO), Mario Dietner (CTO) and Bernarda
  Škrabar Damnjanović (CMO).
- **Product:** Nexus, an agentic OSINT platform offered as a web service.
- **Customers:** law enforcement, corporate security, due diligence, fraud, journalism, threat
  intelligence, sales and competitive intelligence, and brand protection teams. Next Sight's own
  site adds government, child-protection and legal teams.
- **Not to be confused with** Authentic8's Silo Nexus AI or OSINT Combine's NexusXplore; Nexus
  says it is not affiliated with other products that use the name.

## Mission

> "an agentic OSINT platform that gives professional investigators an AI-powered investigation
> workspace" (about page)

## What they sell

- **Nexus:** an AI agent that "plans and carries out multi-step research while you direct and
  decide". It has 47 investigative Skills in 7 categories (an older Next Sight page says 40 in
  six), labels each finding as supported, possible match, contradiction or gap, draws
  relationship graphs and exports PDF reports.
- **Next Sight services:** OSINT and HUMINT services; training in OSINT, OPSEC and HUMINT;
  corporate intelligence; cybersecurity consulting.

## Prices

From the pricing page, current for new subscriptions as of 17 November 2026, in euros:

- **Pro:** €119 a month, or €1,356.60 a year. 400 credits a month, and unused credits carry over;
  43 of the 47 Skills; custody trail; PDF reports.
- **Agency:** €219 a month, or €2,496.60 a year. 800 credits a month; all 47 Skills; relationship
  graphs, end-to-end encrypted notes, encrypted attachments up to 20 MB, priority support.
- **Teams:** "coming soon", custom pricing, several seats.
- **Free:** none on nexus-osint.ai, which says "Nexus has no free plan and no trial". Next Sight's
  own site still offers to "Start free" with 30 credits.

Search results also showed €59 and €89 a month; no page read on 2026-11-25 shows those prices.

## Evidence and AI

- A custody trail "aligned" with ISO/IEC 27037, switched on when a case is created. Entries are
  numbered in sequence and carry SHA-256 hash-chain fields.
- PDF exports carry a SHA-256 hash of the prepared case data.
- Nexus itself says "neither the hash nor the report establishes legal admissibility", while Next
  Sight's site advertises "court-ready PDF reports".
- Data is encrypted in storage and in transit. Which models it uses is not stated.

## Compared with Kucedr's direction

- The closest competitor: an AI agent that investigates, links findings to evidence and keeps a
  hash-chained custody trail. The case log the product direction proposes already exists here.
- What Kucedr can own: Nexus runs in Next Sight's cloud, with its model and its sources. Kucedr
  would run on the investigator's machine, with their browser (Tor, proxy and private tabs), their
  model (local ones included) and their own files.
- Price signal: €119 to €219 a month per account, far above the product direction's €15 to €25
  hypothesis. Investigators already pay for AI investigation tools at this level.

## Sources

- [Nexus](https://www.nexus-osint.ai/), [pricing](https://www.nexus-osint.ai/pricing), [about](https://www.nexus-osint.ai/about) and [what's new](https://www.nexus-osint.ai/whats-new) (updated 2026-11-17), Next Sight
- [What is agentic OSINT](https://www.nexus-osint.ai/agentic-osint), Next Sight
- [Next Sight](https://www.next-sight.com/) and [Nexus on next-sight.com](https://www.next-sight.com/products/nexus)
