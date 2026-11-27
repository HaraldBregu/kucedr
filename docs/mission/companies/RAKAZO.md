# Rakazo

Research note for [the bot-team review](../BOTS.md). Read 2026-11-27 from the sources at the end.
"Not stated" means the pages read did not say. "Secondary" marks a figure from press, a review site
or Product Hunt rather than Rakazo's own pages.

## At a glance

- **Company:** Inbox Zero Inc., a Delaware company at 131 Continental Dr, Suite 305, Newark DE;
  Delaware law governs the terms.
- **People:** Elie Steinbock (GitHub `elie222`), maker of the open-source Inbox Zero email
  assistant (secondary; the site names no founder). Team size, location and funding are not stated,
  and third-party sources disagree on all three.
- **Product:** Rakazo, an Apache-2.0 platform for "persistent AI teammates": bots with their own
  job, model, memory, routines and approval rules, self-hosted for free or on a paid hosted cloud.
- **Customers:** founders and small teams handing off inbox, sales, hiring and expense work;
  enterprise teams that need SSO, SCIM and audit logs.

## Mission

No mission statement. It presents itself as "the open source Grok Bot alternative you actually
own".

## What they sell

- **Bot templates:** Chief of Staff, Sales Outbound, Inbox Manager, Talent Scout, Expense Manager,
  Coding Agent, Account Manager, Paid Media.
- **A computer for bots:** a Linux desktop with Chromium, terminal and files. The homepage shows a
  bot's computer but does not promise one per bot; a review says team bots share one OS user and
  workspace on Docker and only private bots get their own container (secondary).
- **Learning and memory:** show a task once and it is saved as a skill; memory shared across the
  team; routines stored as readable Markdown.
- **Triggers:** schedule, webhook, GitHub event and watched change; email is in the README only.
- **Approvals:** allow and block rules per space, and spending caps.
- **Channels:** Slack and Teams on hosted; Telegram, WhatsApp and iMessage/SMS self-hosted only,
  with the operator bringing business accounts and numbers. Bots can join Zoom or Meet.
- **Integrations:** MCP, Composio, Pipedream Connect and OpenAPI tools.
- **Clients:** web, Electron desktop and Expo mobile apps.
- **Stack:** TypeScript, React, Hono, PostgreSQL, Better Auth, Graphile Worker and an agent library
  listed only as "Pi" (probably the earendil-works/pi harness; not confirmed). About ten sandbox
  providers: Docker by default, or E2B, Daytona and others; Kubernetes on enterprise.

## Prices

From the pricing page, in dollars a month:

| Plan | Monthly | Billed yearly | Computer time included |
| --- | --- | --- | --- |
| Self-hosted | Free | Free | Unlimited |
| Standard | $15 | $12 | $5 |
| Pro | $49 | $39 | $20 |
| Max | $99 | $79 | $40 |
| Ultra | $199 | $159 | $120 |

- The four hosted plans say "unlimited model usage". Whether that means the user's own key or
  Rakazo paying the model bills is not stated. "The provider's price, with no markup" applies to
  the separate Credits plan, from $20 a month.
- Managed dedicated hosting: $300 a month, with SSO, audit log and encryption at rest.
- 7-day trial with $3 of computer time; Black Friday code for 30% off yearly plans until
  2026-11-30.

## Partners and resale

- **Affiliate:** on Dub, "25% per sale for 1 year". Cookie window, payout threshold and eligibility
  not stated.
- **No reseller, agency or white-label programme.** The terms forbid reselling or providing the
  hosted service to others without written permission, and grant no rights to the name or logo.

## Traction

- GitHub: 10.0k stars, 1.8k forks, 5,196 commits, 207 open issues; commits on 2026-11-27.
- Star history (secondary): 747 on 2026-08-17, 5.6k on 2026-10-22, 8,400 at the Product Hunt launch.
- Product Hunt #1 Product of the Day on 2026-11-15 with 421 points (secondary).
- "13,000+ professionals" on the homepage, with company names in plain text, one of them the
  founder's own Inbox Zero. No revenue or reviews found. Treat as marketing.

## Weak points

- Beta software with breaking changes expected (secondary).
- The homepage still offers sign-in with a Claude Pro or Max plan; the maker said on Product Hunt
  that Claude needs an API key. Anthropic barred subscription sign-in in third-party tools in
  February 2026 (secondary).
- Privacy policy: pseudonymous product analytics, processing "in the United States and other
  countries", memory through Supermemory and Hindsight Cloud. Pricing lists EU hosting as "Your
  choice" without detail.
- Terms: GDPR not mentioned; liability capped at the greater of 12 months of fees or $100; no SOC
  2, ISO or SLA.
- Its own self-hosting page says self-hosting the agent does not self-host the model.

## Compared with Kucedr

- A general bot platform for office work, not an investigation tool. Its templates map onto
  directions Kucedr's documents already dropped: chief of staff, back-office agent, coding agent,
  agent platform.
- Overlap with what Kucedr has: an agent loop, scheduled tasks, approvals, MCP, any model including
  Ollama, an Electron app. Kucedr has no computer use, no runs while closed, no team features and no
  server.
- What Kucedr could borrow: Markdown routines and a recorded run turned into a skill. Both are
  unscoped ideas, not plans.

## Sources

- [Rakazo](https://rakazo.com/), [pricing](https://rakazo.com/pricing/),
  [terms](https://rakazo.com/terms/), [privacy](https://rakazo.com/privacy/),
  [enterprise](https://rakazo.com/enterprise/),
  [self-hosted AI agent](https://rakazo.com/self-hosted-ai-agent/),
  [messaging apps](https://rakazo.com/docs/messaging-apps/)
- [GitHub repository](https://github.com/elie222/rakazo) and
  [README](https://raw.githubusercontent.com/elie222/rakazo/main/README.md)
- [Affiliate page on Dub](https://partners.dub.co/inboxzero/rakazo)
- Secondary: [Product Hunt](https://www.producthunt.com/posts/rakazo-2),
  [byteiota](https://byteiota.com/rakazo-open-source-grok-bot-alternative/),
  [Enterprise DNA](https://enterprisedna.co/resources/ai-pulse/ai-pulse-2026-08-17-an-open-clone-of-xai-s-brand-new-grok-bot-ships-in-five-days),
  [The Register on the Claude sign-in ban](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access)
