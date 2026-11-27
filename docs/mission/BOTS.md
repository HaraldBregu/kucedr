# Bot teams: Rakazo, MausBot and OpenBot

Status: proposal, written 2026-11-27 from the owner's request to analyse
[Rakazo](https://rakazo.com/), [MausBot](https://mausbot.com/partners) and
[OpenBot](https://openbot.run/it), show how Kucedr could fit, and say whether to go that way.
Nothing here is decided or built, and no existing document was changed. Each product has a research
note in [companies](companies/) with its sources. "Secondary" marks a figure from press, a review
site or Product Hunt rather than the company's own pages. What could not be checked is listed
[at the end](#not-verified).

## Summary

- **Verdict: no-go.** All three are open copies of xAI's Grok Bot: a team of always-on bots for
  general office and coding work, made money from hosted machines. That is the agent-platform,
  chief-of-staff and coding-agent market the earlier documents already ranked "No"
  ([DIRECTIONS.md](DIRECTIONS.md#all-directions-ranked) rows 10, 11 and 13;
  [PRODUCT.md](PRODUCT.md#3-directions-considered) rows 4 and 7). Its business model needs hosting,
  accounts and unattended runs, which conflict with the Private promise and with keeping approvals
  ([MISSION.md](MISSION.md#1-the-mission-in-five-promises) §1 and §2).
- **Kucedr would arrive tenth, with 12 stars,** against products holding 10k to 28k stars that ship
  daily, and against model companies that include the same job in a $20 plan.
- **Take three small things, all inside the current plan:** copy OpenBot's release signing and
  software bill of materials for the signed-builds gate; correct the messaging claim in
  [FEATURES.md](../FEATURES.md); ask the Phase 0 buyers one question about unattended runs.

## The three products side by side

All figures read 2026-11-27 from the companies' own pages unless marked.

| | [Rakazo](companies/RAKAZO.md) | [MausBot](companies/MAUSBOT.md) | [OpenBot](companies/OPENBOT.md) |
| --- | --- | --- | --- |
| What | Platform for "persistent AI teammates", each bot with a job, model, memory and routines | Desktop chat app where bots run on Claude Code, Codex, Grok and other agent tools | Desktop app running named agents on the coding-agent tools the user already pays for |
| Target | Founders and small teams (inbox, sales, hiring, expenses); enterprise with SSO and SCIM | Individuals and teams up to 50 (sales, support, recruiting, SEO, bug fixing) | Individuals with an AI plan, small teams, agencies, companies wanting agents 24/7 |
| How it runs | Self-hosted server (Docker, about ten sandbox vendors) or hosted cloud; web, desktop and mobile clients | Local harness server plus Electron UI; paid cloud machine for runs while the laptop is closed | Local Electron app; optional hosted server; phone apps and messaging through its own relay |
| Own agent loop | A third-party library listed as "Pi" (not confirmed) | Mostly wraps vendor tools; the Terms mention an own engine | No; wraps vendor tools over the Codex App Server, Claude Agent SDK and ACP |
| Licence | Apache-2.0 | Apache-2.0, except a source-available `enterprise/` folder | PolyForm Noncommercial since 0.1.12; Apache-2.0 before |
| Price | Self-host free; hosted $12 to $159 a month billed yearly; managed $300 | Free; $19, $49, $99 a month; Team from $40; Business self-hosted $299 | Personal free; servers €24 to €80 a month; licences €7.20 and €18 a member a month, free until 1 December 2026 |
| How it makes money | Hosted computer time and credits | Cloud compute, team seats, self-hosted licence, white-label add-on, paid partner listings | Commercial seats, hosted servers, credits |
| Partner terms | Affiliate on Dub, 25% for one year; resale of the hosted service forbidden | "Featured Partner" listing that partners pay for; no fee or commission published; resale forbidden | No partner programme; referral pays 10% as Stripe credit that is not paid out; no white-label, a seat per client user, no competing product |
| Traction | 10.0k stars, 1.8k forks; PH #1 on 15 Nov (secondary); "13,000+ professionals" unverified | 28.4k stars, 4.0k forks; 140k users and 90k visitors self-reported; PH 167 points, no reviews (secondary) | 11.5k stars, 1.1k forks; 22k to 35k first-day downloads per release, probably including updates |
| Company | Inbox Zero Inc., Delaware; founder Elie Steinbock (secondary) | Supamaus Software Pvt Ltd, India; Omkar Satpute and Milind Soni | Synthetify Labs sp. z o.o., Poland; Nightly Labs team |
| Age | Repository about three and a half months old | Repository created 2026-08-11 | Repository created 2026-08-12 |
| Revenue found | None | None | None |

## The common direction

The three were started within days of Grok Bot's closed beta on 11 August 2026 (secondary). MausBot's
own comparison page, dated 15 November, lists about 25 rivals, closed and open, and names Rakazo and
OpenBot among them. What they share:

- **Bots with jobs, not a chat.** Each bot has a role, a model, a workspace, routines and triggers.
- **Always on.** The paid product is a machine that keeps bots running when the user's laptop is
  closed: Rakazo's computer hours, MausBot's cloud computer, OpenBot's hosted server.
- **Someone else's models, often someone else's agent.** MausBot and OpenBot drive Claude Code,
  Codex and Gemini on the user's own subscriptions. Anthropic barred subscription sign-in in
  third-party tools in February 2026 and enforced it from April (secondary). OpenBot's own terms page
  says Anthropic "has not confirmed" its sign-in is allowed. The category's main hook, "the plans you
  already pay for", can be withdrawn by a vendor in a day.
- **General work.** Inbox, sales, hiring, bookkeeping, coding. Nothing in any of the three is
  about investigations, evidence or confidential client files.
- **Attention, not revenue.** Tens of thousands of stars, daily releases, thousands of open issues,
  and no published revenue anywhere. Grok Bot, Claude Cowork, Claude Duet, OpenAI Dots and Gemini do
  the same job inside the vendors' own plans.

## How Kucedr could fit

Kucedr already has more of this than it seems: an agent loop with subagents, workspaces that each
keep their own chats, tasks and model ([WORKSPACES.md](../roadmap/WORKSPACES.md)), scheduled tasks,
approvals, MCP, 22 providers and Ollama, a browser the agent shares with the user, and a coding
harness that speaks the protocol OpenBot uses for Codex. What it lacks is the part the category
charges for.

| Option | What Kucedr has | What is missing | Verdict |
| --- | --- | --- | --- |
| A. Compete: a bot team with an always-on tier | Agent loop, workspaces, schedules, approvals, MCP, providers, browser pane | Runs while closed (16.7, size L, nothing built); computer use ([COMPUTER.md](../roadmap/COMPUTER.md): "Nothing controls the desktop"); a hosted machine; mobile apps ("Not planned", [roadmap/README.md](../roadmap/README.md#not-planned)); team features; messaging channels; hundreds of connectors; checkout | No |
| B. Be an engine inside MausBot or OpenBot | SDK, CLI, app-server harness | An ACP server mode; a headless agent (the CLI only launches the app); Tor and proxy in background runs, which refuse every route but direct. Wrapped, Kucedr becomes one more agent loop running under another app's full-access default | No |
| C. Join a partner programme | Nothing that applies | Rakazo pays affiliates 25% for a year; MausBot charges vendors of models, compute and tools for a listing; OpenBot has none. At 258 downloads the affiliate route is worth tens of dollars a month and sends users to a US cloud | No |
| D. Build "Kucedr Cloud" | A skippable Supabase account, S3-compatible backup | Hosting, billing, checkout, tenant isolation, support, a legal entity, the Cyber Resilience Act answer. The largest build and the furthest from the mission | No |
| E. A private-web and capture tool other agents call over MCP | MCP client, per-tab routes, shield, screenshot and PDF capture | An MCP server mode (`src/main/mcp` is client only); routes in headless runs; the capture record (25.1) that is Phase 2 work. No buyer has asked | Not now; revisit only as a by-product of Phase 2 |
| F. Stay on the desk and take lessons | Everything needed | Nothing | **Recommended** |

**"Bots as workspaces" on the desktop.** The strongest variant an advocate can make: workspace
presets with bundled skills and schedules, plus 16.7 "Run while closed" from the tray, so a user gets
bots with jobs and no server. It keeps the mission whole. But it is still a general assistant feature
for individuals, and 16.7 is already in [TARGET.md](TARGET.md#phase-4-grow) Phase 4 as "watching a
subject" for the desk. If desk buyers ask for it, the case-monitoring bot is that item, built for the
desk.

## Pros and cons

**The advocate's strongest points**

- **Distribution is Kucedr's real bottleneck,** and this category has the attention: 10k to 28k
  stars each in three months, against Kucedr's 12. "Alternative to Grok Bot" lists
  (openalternative, alternativeto and others) are being written now and accept free entries.
- **The ownership pitch draws attention.** Rakazo's headline, "the open source Grok Bot alternative
  you actually own", reached Product Hunt's top spot. Rakazo's own page admits "self-hosting the agent
  does not self-host the model".
- **The trust slot is empty.** None of the three mentions Tor. OpenBot runs agents with full access
  by default; MausBot's default approval mode is "Full access"; Rakazo's privacy policy sends memory
  to outside services. "An agent that asks before it acts" is unclaimed.
- **Reuse is real:** workspaces, schedules, Markdown skills, MCP and the app-server harness map onto
  the category's pieces.
- **One thing helps today's plan whatever is decided:** OpenBot ships Sigstore signatures and SPDX
  software bills of materials with every release, which serves the signed-builds gate and the
  Cyber Resilience Act question.

**The skeptic's strongest points**

- **It is the wrong demand.** Stars and installs do not move the Phase 0 pass mark: three firms
  prepaying €3,000, or two paid due-diligence pilots ([TARGET.md](TARGET.md#order)). The audience is
  developers and automation hobbyists. "Individuals do not repay acquisition": €156 affordable
  per individual against €955 per firm, and 6.1% of consumer AI subscribers remain after a year
  ([ECONOMICS.md](ECONOMICS.md#churn-acquisition-and-the-funnel)).
- **Always-on means unattended, and unattended means no one answers approvals.** OpenBot's
  `approvalPolicy: never` default is where the category goes. That is reading (b) of "without
  guardrails", which [MISSION.md](MISSION.md#2-the-two-ambiguous-words) rejects.
- **It is built on subscription arbitrage.** Vendors either restrict third-party sign-in, which
  removes the hook, or ship the feature themselves (Cowork runs tasks with the app closed in the $20
  plan). Kucedr's own rule allows only an API key for Claude
  ([CODING.md](../roadmap/CODING.md#open-decisions)), so it would enter without the hook and still
  carry the risk.
- **The margin is commodity compute.** Rakazo includes "unlimited model usage" from $12; MausBot sells
  shared CPU at $0.05 an extra hour; OpenBot's seats start at €7.20. Nothing is left for a follower.
- **Kucedr cannot yet claim trust against them.** Its builds are unsigned (MausBot's macOS build is
  signed), the vault is opt-in and leaves out `run.jsonl`, embeddings are remote, and Tor was tested
  only against a fake server. Until Phase 1 ships, the contrast cannot be said
  ([MISSION.md](MISSION.md#7-words-and-when-they-can-be-used)).
- **One maintainer cannot keep pace.** MausBot makes about 130 commits a day and OpenBot about 50,
  each tracking a dozen vendor tools that change weekly ([MISSION.md](MISSION.md#8-risks), "One
  maintainer").
- **Hosting brings duties before revenue:** a legal entity, GDPR processor obligations, and
  "manufacturer" status under the Cyber Resilience Act once paid
  ([FRONTIER.md](FRONTIER.md#legal-and-platform-limits)).
- **It may be a fad.** Clone families appear within days of each vendor launch; Atlas closed in
  August 2026 and Vellum's hosted service in November. No product in the category has shown revenue.

**Where both are wrong.** The advocate overstates reuse: background runs refuse Tor and proxy, the
CLI is not a headless agent, and there is no MCP server. The skeptic is right that stars are not
buyers, but a free listing costs an hour and can be measured; it is a test, not a direction.

## Alignment with the mission

| Mission point | Bot-team direction | Fit |
| --- | --- | --- |
| Private: no account, no telemetry, nothing leaves except to a chosen recipient ([MISSION.md](MISSION.md#1-the-mission-in-five-promises) §1) | Hosted machines, accounts, relays for messaging; OpenBot's mobile app ships analytics; Rakazo has product analytics | Conflicts |
| Secure: approvals stay; reading (b) rejected (§2) | Unattended bots, full-access defaults | Conflicts |
| Free: MIT, no content rules, any model (§1, §2 reading (a)) | All three use any model including Ollama; two are Apache-2.0 | Matches, but every rival shares it |
| Order of work: computer use, integrations, the coding page and the plugin catalogue move down (§6) | Those are the category's headline features | Conflicts |
| Words: no "fully private" (§7) | A contrast line such as "nothing leaves your machine" is not true today | Conflicts if used |
| One maintainer (§8) | Several L-sized areas plus a daily-moving field | Conflicts |
| Who pays: the investigation and due-diligence desk ([TARGET.md](TARGET.md#summary)) | Individuals and small office teams | Conflicts |
| Dropped directions ([DIRECTIONS.md](DIRECTIONS.md#dropped-and-why)) | Browser back-office agent (10), chief of staff (11), agent platform and white-label (13) | Already "No" |
| Coding agent ([PRODUCT.md](PRODUCT.md#3-directions-considered) row 7) | OpenBot and MausBot are mostly coding-agent wrappers | Already "No" |
| Local power users pay nothing ([MARKETS.md](MARKETS.md#all-directions-ranked), D09) | The category's free tiers are these users | Confirms |
| Not planned: mobile or web companion, telemetry ([roadmap/README.md](../roadmap/README.md#not-planned)) | Mobile apps in all three | Conflicts |
| What waits ([TARGET.md](TARGET.md#what-waits)) | Computer use, integrations, plugin catalogue, coding page | Conflicts |

The only match is character traits every rival also has. On everything that decides money and focus
the direction conflicts with the mission. Alignment: about 1 to 2 out of 10 for the direction, 4 out
of 10 for the narrow MCP-tool variant, which still waits on Phase 2.

## Recommendation

**Do**

1. **Stay on [TARGET.md](TARGET.md#order).** Phase 0 calls in December, Phase 1 trust gates in
   parallel.
2. **Copy OpenBot's release practice into Phase 1 gate 1:** a signature and an SPDX software bill
   of materials attached to each release. Same work as signing, and useful for the Cyber Resilience
   Act.
3. **Correct [FEATURES.md](../FEATURES.md) line 3.** It says Kucedr does "messaging-channel replies";
   a search of `src/` and `resources/` found no Slack, Telegram, Discord or WhatsApp code. Fix the
   claim rather than build channels to match it.
4. **Add one line to [COMPETITION.md](COMPETITION.md#where-kucedr-should-not-compete)** when it is
   next revised: Grok Bot copies (Rakazo, MausBot, OpenBot) crowd open general agents, and their
   access depends on vendors' subscription rules.

**Do not**

- Build a hosted machine, mobile apps, team accounts, messaging relays or bot templates for office
  work.
- Join Rakazo's affiliate programme or pay for a MausBot listing.
- Wrap Kucedr as an engine for another bot app.
- Fork any of them. Rakazo's name is not licensed, OpenBot's licence forbids competing products, and
  any fork brings a server stack the mission rules out.
- Use contrast lines that break [MISSION.md §7](MISSION.md#7-words-and-when-they-can-be-used).

**Cheap tests before anything else is committed**

| Test | Cost | Pass mark | If it passes |
| --- | --- | --- | --- |
| Ask each Phase 0 buyer: "Would you want a case watched while the laptop is closed?" and "Do you already run an agent app that would call a capture tool?" | Two questions in calls already planned | 5 or more of about 20 say yes to either | Bring 16.7 and routes for background runs forward within the desk; scope the MCP capture tool as part of 25.1 |
| List Kucedr on two "Grok Bot alternative" sites with words §7 allows ("local desktop app, no server, your own model") | About an hour | Downloads rise above 258 by 100 or more in four weeks | Keep the listings as top of the funnel for the free client and for grant applications. Nothing else changes |
| Watch OpenBot after its licences stop being free on 1 December: first-day downloads per release and whether a seat prompt appears | 15 minutes a month until March 2027 | Downloads hold and the licence is enforced | Evidence that the category can charge. It still does not justify entering it head-on |

If all three fail, the question is closed. If they pass, the answer is still a desk feature, never
the platform.

## Not verified

- No revenue, paying-customer or seat figures exist for any of the three.
- Self-reported figures: Rakazo's "13,000+ professionals"; MausBot's 140k users, 90k visitors and
  "16 engines" (only four are named).
- Star histories, Product Hunt scores and founder backgrounds come from third-party sources.
- What Rakazo's "Pi" library is, and whether its hosted "unlimited model usage" means the user's
  key.
- MausBot's partner fee; its storage limits per plan; its Windows signing; its phone app ratings.
- OpenBot's download counts include updates in an unknown share; which licence tiers are free
  until 1 December; credit prices; whether its marketplace plugins work; clause 1.6 on agents and
  seats.
- Anthropic's subscription sign-in rules were read in press coverage, not in Anthropic's own terms.
- The "channel service" in [ARCHITECTURE.md](../ARCHITECTURE.md) was not opened; the search for
  messaging code covered `src/` and `resources/` only.
- Not fetched: Rakazo's download, integrations and support pages; MausBot's privacy, refund and
  solutions pages; OpenBot's privacy policy, DPA and changelog. One third-party page about OpenBot's
  team contained text addressed to AI tools; it was ignored.
