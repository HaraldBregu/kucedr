# Margins and unit economics

What it costs Kucedr to serve one customer, what is left at different prices, and how many
customers cover a month of fixed costs. Prices and benchmarks were read on 25 November 2026 from
the sources linked in each section. Everything marked **assumption** is a planning figure the
[paid pilot](RESEARCH.md#paid-pilot-and-decision-criteria) has to replace with measured numbers.
Competitor prices are in [How Kucedr competes](COMPETITION.md).

Dollar costs are converted at $1.094 per euro, the ECB reference rate on 25 November 2026.
Prices are shown without VAT; for EU business customers VAT is reverse-charged.
[ECB rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html)

## Summary

- **Software costs are small; people's time is not.** A standard brief costs about €0.13 to €1.74
  in model and search fees depending on the model. Five minutes of support costs €5 at the planning
  rate of €60 an hour, more than a heavy research run on Sonnet 5.5.
- **A plan where customers use their own keys keeps about 96% before support.** A hosted plan, where
  Kucedr pays for the model, keeps 60% to 90% when usage is capped and can lose money when it is not.
- **Firms pay back the selling effort; individuals do not.** Each €1,000 a month of fixed cost needs
  about 12 three-seat firms or about 71 individual seats at €20. The firm direction in
  [RESEARCH.md](RESEARCH.md) is the better first revenue; individual seats are better treated as the
  open-source funnel.
- **The €250 assisted pilot loses money** once four hours of the founder's time are counted. Price it
  at €500 or more, or book it openly as the cost of acquiring the firm.

## What one brief costs to run

Two workloads, both **assumptions** to replace with traces from real runs
(`~/.kucedr/sessions` records each run):

- **Standard brief:** 300,000 input tokens, 30,000 output tokens and 20 web searches. Roughly 15
  agent turns re-reading a 20,000-token context.
- **Heavy brief:** 2,000,000 input tokens, 100,000 output tokens and 60 web searches.

Page fetches cost nothing extra: Kucedr's browser and fetch tool retrieve pages on the user's
machine. Searches are priced at Brave's $5 per 1,000.

| Model (input / output per million tokens) | Standard brief | Heavy brief |
| --- | --- | --- |
| Haiku 5.5 ($0.10 / $0.50, prompts up to 100k tokens) | $0.15 · **€0.13** | $0.55 · **€0.50** |
| Sonnet 5.5 ($2 / $10) | $1.00 · **€0.91** | $5.30 · **€4.84** |
| Opus 5.5 ($4 / $20) | $1.90 · **€1.74** | $10.30 · **€9.41** |

OpenAI's gpt-6.2-sol has the same list price as Sonnet 5.5 and gpt-6-luna the same as Haiku 5.5, so
the table holds for either provider. Haiku 5.5 costs five times more per token for prompts above
100,000 tokens. Cache reads cost one-twentieth of the input price on both providers' lists, and
batch processing halves the price. A loop that re-reads the same context could cut the input share
sharply; measure it before counting on it.
[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) ·
[OpenAI pricing](https://developers.openai.com/api/docs/pricing) ·
[Brave Search API](https://brave.com/search/api/)

**Search results cannot be the evidence.** Brave's terms (updated 1 September 2026, §3(b)(i)) forbid
storing or caching results beyond transient use without a custom plan. The preserved source in a
brief has to be the page Kucedr fetched or captured itself, never the search API's response.
Tavily ($8 per 1,000 basic searches), Exa ($7 per 1,000) and Firecrawl (about $1.98 per 1,000
searches on its $99 plan) are alternatives; their storage terms need checking before use.
[Brave terms](https://api-dashboard.search.brave.com/terms-of-service) ·
[Tavily credits](https://docs.tavily.com/documentation/api-credits) ·
[Exa pricing](https://exa.ai/pricing) · [Firecrawl pricing](https://www.firecrawl.dev/pricing)

## What payment costs

For a seller in Italy, Stripe charges 1.5% + €0.25 for a standard EEA card, plus 0.7% for Billing
(subscriptions) and 0.5% for Stripe Tax where Kucedr is registered. International cards cost
3.15% + €0.25.

| Charge | Stripe card + Billing + Tax | Share of the price |
| --- | --- | --- |
| €5 a month | €0.39 | 7.7% |
| €20 a month | €0.79 | 4.0% |
| €49 a month | €1.57 | 3.2% |
| €200 a year | €5.65 | 2.8% |
| €29 one-off brief (no Billing fee) | €0.83 | 2.9% |
| €500 pilot invoice paid by card (no Billing, no Tax) | €7.75 | 1.6% |

The fixed €0.25 weighs most on small monthly charges; annual billing reduces it. Paddle, which acts
as merchant of record and handles sales tax worldwide, charges 5% + $0.50 (€1.46 on €20). Stripe
Managed Payments adds 3.5% to act as merchant of record but excludes services delivered with human
involvement, so assisted pilots would be invoiced directly. Lemon Squeezy takes no new sign-ups and
closes on 31 March 2027.
[Stripe pricing](https://stripe.com/it/pricing) · [Stripe Billing](https://stripe.com/it/billing/pricing) ·
[Stripe Tax](https://stripe.com/it/tax/pricing) ·
[Managed Payments eligibility](https://docs.stripe.com/payments/managed-payments/eligibility) ·
[Paddle pricing](https://www.paddle.com/pricing) ·
[Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees)

## Gross margin by plan

Gross margin here is price minus payment fees, model and search costs, storage and support time,
divided by price. Support time is valued at €60 an hour (**assumption**, the planning rate in
[RESEARCH.md](RESEARCH.md#what-the-economics-would-need-to-look-like)): €5 per five minutes.

### Own keys: the customer pays the model provider

Kucedr's variable cost is payment and support. At €20 a month, the midpoint of the
[product direction's](PRODUCT.md#8-how-it-pays) €15 to €25 hypothesis:

| Support per customer per month | Left after fees and support | Gross margin |
| --- | --- | --- |
| None | €19.21 | 96% |
| 5 minutes | €14.21 | 71% |
| 15 minutes | €4.21 | 21% |

This plan only works if almost every customer serves themselves. Setup is where the time goes: the
[software assessment](SOFTWARE.md#from-first-launch-to-handoff) found that setup centres on
providers, models and keys before any research starts.

### Hosted: Kucedr pays for the model and search

A seat at €49 a month (**assumption**, between Hunchly's €149 a year and Nexus's €119 a month),
before support:

| Monthly usage per seat | Model and search | Gross margin |
| --- | --- | --- |
| 4 standard briefs on Sonnet 5.5 | €3.64 | 89% |
| 10 standard briefs on Sonnet 5.5 | €9.10 | 78% |
| 20 standard briefs on Sonnet 5.5 | €18.20 | 60% |
| 20 standard briefs on Haiku 5.5 | €2.60 | 91% |
| 20 standard briefs on Opus 5.5 | €34.80 | 26% |
| 10 heavy briefs on Sonnet 5.5 | €48.40 | −2% |

An unlimited hosted plan is a bet on how hard customers use it. Nexus sells credits (400 a month at
€119) and OSINT Pilot sells one credit per investigation for this reason. Include an allowance
worth about €12 at cost per seat (13 standard Sonnet briefs or two heavy ones) and sell further
credits at about twice cost. With the allowance fully used, the seat keeps 72% before support,
close to the 76% public SaaS median and well above the 45% ICONIQ reports for AI products in 2025.
[Nexus pricing](NEXUS.md#prices) · [OSINT Pilot pricing](OSINT_PILOT.md#prices) ·
[Clouded Judgement, 20 Nov 2026](https://cloudedjudgement.substack.com/p/clouded-judgement-111926-security) ·
[ICONIQ State of AI 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026)

### Per brief: a firm pays when it delivers

For firms with occasional work, €29 per brief (**assumption**) paid by card:

| Brief | Model and search | Gross margin |
| --- | --- | --- |
| Standard on Sonnet 5.5 | €0.91 | 94% |
| Heavy on Sonnet 5.5 | €4.84 | 80% |
| Heavy on Opus 5.5 | €9.41 | 65% |

The firm's own client pays far more for the report. Published list prices run from £495 + VAT
(Simplified.ID enhanced due diligence) and £750 + VAT (London Private Investigators corporate due
diligence) to $650 for a NAVEX open-source report, $1,800 for its enhanced report and $8,000 with
site visit and source commentary. €29 is 2% to 6% of a €500 to €1,500 report.
[Simplified.ID](https://simplified.id/enhanced-due-diligence/) ·
[London Private Investigators](https://londonprivateinvestigators.com/blog/how-much-does-a-private-investigator-cost-in-london/) ·
[NAVEX price list](https://www.navex.com/en-us/risk-rate-report-price-list/) ·
[Verdict pricing](https://verdict.net/pricing/)

What the firm will pay depends on the time Kucedr saves, not on the report price. Published
investigator rates are €60 an hour in Italy (Dogma) and £65 to £80 an hour in the UK (London Private
Investigators, Tremark). One hour saved on a brief is worth €60 to €95 to the firm, and a €29 price
takes a third to a half of it. Twenty minutes saved, the illustration in the commercial research,
is worth about €20, less than the price. The pilot's paired timings decide which case applies.
[Dogma rates](https://www.dogma.it/it/tariffe-agenzia-investigativa) ·
[Tremark](https://www.tremark.co.uk/how-much-do-private-investigators-cost/)

### Assisted pilot: the founder's time is the cost

Four hours of setup and support (**assumption** from RESEARCH.md) at €60 an hour, two heavy Sonnet
briefs and card fees:

| Pilot price | Left | Margin |
| --- | --- | --- |
| €250 | −€3.68 | −1% |
| €500 | €242.57 | 49% |
| €750 | €488.82 | 65% |

At €250 the pilot is a customer acquisition cost: five firms cost about €1,200 of founder time.
That can be the right call to recruit the first five, as long as the books say so.

### Encrypted case backup

Cloudflare R2 charges $0.015 per GB-month with no egress fees; Backblaze B2 $6.95 per TB-month.
Ten gigabytes on R2 costs about €0.14 a month. Sold at €5 a month, backup keeps 90%; at €50 a year,
93%. Storage operations and support are not counted.
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) ·
[Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing)

## Fixed costs and break-even

Known fixed costs are small: the Apple Developer Program at $99 a year (€90) for notarised macOS
builds and Azure Artifact Signing Basic at $9.99 a month (€110 a year) for Windows. Artifact
Signing accepts individual developers only in the US and Canada; a developer in Italy needs an
organisation identity. Company administration, accounting, the website and above all the founder's
own pay are the real fixed costs and are not priced here.
[Apple Developer Program](https://developer.apple.com/programs/whats-included/) ·
[Artifact Signing quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)

Monthly contribution per customer after fees, model costs and support, and the number of customers
each €1,000 a month of fixed cost needs:

| Customer | Contribution a month | Customers per €1,000 a month |
| --- | --- | --- |
| Individual, own keys, €20, 5 min support | €14.21 | 71 |
| Individual, hosted, €49, allowance used, 10 min support | €25.43 | 40 |
| Firm, 3 hosted seats on one €147 invoice, allowances used, 20 min support | €86.78 | 12 |

## Churn, acquisition and the funnel

ChartMogul measured 6.1% monthly customer churn for products under $25 a month and 2.2% above
$500 a month (2022 data). At 6.1%, a customer stays about 16 months on average.

| Customer | Lifetime contribution | Affordable acquisition cost at 11-month payback |
| --- | --- | --- |
| Individual, own keys, €20 | €233 at 6.1% churn | €156 |
| Firm, 3 hosted seats | €1,423 at 6.1% to €3,944 at 2.2% churn | €955 |

The 11 months is the median CAC payback Aleph and Benchmarkit report for contracts under $5,000 a
year. A firm can carry founder-led sales: demos, a pilot, an introduction through the Association
of British Investigators directory. An individual seat cannot carry any paid acquisition and has
to come from the open-source project, word of mouth and listings such as Bellingcat's toolkit.
[ChartMogul churn](https://chartmogul.com/blog/good-customer-churn-rate/) ·
[CAC payback 2026](https://www.getaleph.com/answers/cac-payback-period-saas-2026) ·
[Bellingcat](BELLINGCAT.md)

The funnel this implies is large. ChartMogul's 2026 report puts median free-to-paid conversion at
8% and calls 6% to 8% good for AI-native products; a secondary source puts open-source users who
pay at 0.5% to 3%. Seventy-one paying individuals at €20 need about 900 active free users at 8%, or
about 4,700 at 1.5%.
[ChartMogul conversion report](https://chartmogul.com/reports/saas-conversion-report/) ·
[Open-source conversion (secondary)](https://www.getmonetizely.com/articles/whats-the-optimal-conversion-rate-from-free-to-paid-in-open-source-saas)

## What the pilot must measure

The model above rests on five numbers. Each has a place to measure it:

| Number | Assumed | Where to measure |
| --- | --- | --- |
| Tokens and searches per brief | 330,000 tokens and 20 searches (standard) | Run traces from the pilot briefs |
| Minutes saved per brief | 20 to 60 | Paired timings in the pilot |
| Support minutes per customer per month | 5 to 20 | A log of founder time per firm |
| Setup hours per firm | 4 | The same log, first month |
| Monthly churn | 2.2% to 6.1% | Accounts active after the third brief |

If tokens per brief come in at the heavy figure, a hosted plan needs a smaller allowance or Haiku
by default. If minutes saved stay near 20, per-brief pricing above €20 will not hold and the offer
becomes an assisted service. If support exceeds 15 minutes a month per individual, the own-key plan
does not pay for itself.
