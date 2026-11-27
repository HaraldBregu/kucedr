# MausBot

Research note for [the bot-team review](../BOTS.md). Read 2026-11-27 from the sources at the end.
"Not stated" means the pages read did not say. "Secondary" marks a figure from press, a review site
or Product Hunt rather than MausBot's own pages.

## At a glance

- **Company:** Supamaus Software Private Limited, incorporated in India; courts in Pune have
  jurisdiction. Terms updated 2026-11-11.
- **People:** Omkar Satpute and Milind Soni, named on the partner page. The repository sits under
  Milind Soni's personal account.
- **Product:** MausBot (OpenMausBot), an Apache-2.0 desktop chat app that runs a team of bots on top
  of agent tools the user already has (Claude Code, Codex, Grok), with a paid cloud machine that
  keeps them running when the laptop is closed.
- **Customers:** individuals and small teams automating sales follow-ups, support, recruiting,
  bookkeeping, bug fixing and SEO; teams up to 50 people; self-hosted business installs.

## Mission

No mission statement. It describes itself as an "Open-source Grok Bot alternative with a virtual
machine that bots can use". The repository was created on 2026-08-11, the day Grok Bot entered
closed beta (secondary).

## What they sell

- **Bots as chat contacts,** each with its own job, engine, computer and connected apps.
- **Engines:** "16 agent engines" claimed; the pages read name Claude Code, Codex, Grok and Hermes,
  plus OpenClaw run as a bot, and any ACP command or OpenAI-compatible endpoint. The README has
  drivers for the Claude, Codex and Grok tools. The Terms also mention MausBot's own engine.
- **Connected apps** through Composio ("hundreds more" in the README).
- **Triggers:** scheduled routines, webhooks and app events.
- **Computer use:** browser, terminal, files, a local VM, the user's own machine (opt-in, macOS and
  Ubuntu Xorg), and cloud Linux desktops from the partner Boat.
- **Approval cards** for shell commands, file edits and questions. The default approval mode is
  "Full access" according to the comparison page.
- **Teams:** shared bots, team memory, an owner inbox per bot, admin rules, a CSV audit log.
- **Also:** voice with the user's OpenAI key, a stdio MCP server for outside clients, iOS and
  Android companion apps that pair with the computer running the bots.
- **Announced, not shipped:** an "AI Harness SDK" for software companies ("Coming soon"); MausBox,
  a home AI box that "may not ship".
- **Technically:** a React UI and a local harness server on 127.0.0.1:8799 that turns every
  engine's output into one event stream logged per thread as NDJSON; data under `~/.openmausbot`;
  Electron shell. The `enterprise/` folder is source-available and needs a licence key; when the
  licence lapses the app falls back to the open-source edition.

## Prices

From the pricing page, in dollars a month. Model usage is never included.

| Plan | Price | Cloud computer-hours a month | Notes |
| --- | --- | --- | --- |
| Free | $0 | None | Bots run only while the user's computer is on |
| Starter | $19 | 100 | 5 bots awake, 2 working |
| Pro | $49 | 300 | Slack DMs, spend cap, setup call |
| Max | $99 | 800 | About 8 bots working at once |
| Team | $40 for 2 people, $20 per extra, up to 50 | 300 for 2, plus 100 per person | Extra hours $0.05 |
| Business self-hosted | $299 for up to 20 people, $10 per extra | Own hardware | Install help $600 a day; own logo, name and domain +$99 |

- Payments are final except duplicate charges; Dodo Payments is the merchant of record; no uptime
  guarantee "during the founding period"; liability capped at three months of fees.

## Partners and resale

- **Featured Partner** programme for model and inference providers, compute and sandbox providers,
  and tool makers. A partner gets a labelled spot in the app, a sign-up button, a launch video, a
  listing on the pricing and partners pages, a setup guide and a tracked link. "If you have no
  integration, they build one."
- The page says applicants are told a category is full "before you pay", so partners pay MausBot.
  No fee or commission is published. Current partners: Boat and ModelGo.
- Users may not resell access or share accounts or cloud machines. There is no affiliate programme.

## Traction

- GitHub: 28.4k stars, 4.0k forks, about 14,100 commits (about 130 a day), about 1,100 open issues
  and 377 pull requests.
- Self-reported on the partner page: 140k+ app users, 90k unique monthly visitors, 9.9k Discord
  members. Not confirmed anywhere else.
- Product Hunt (secondary): launched about 2026-10-13, 167 points, day rank 7, no reviews.
- No revenue or paying-customer figures found.

## Weak points

- About three and a half months old, about a release a day, a backlog of more than 1,000 issues.
- Keys set from the CLI or server, OpenCode keys, per-engine keys and MCP header values are stored
  in plain text; the packaged desktop app encrypts provider keys through the OS (README). Port 8799
  must never be exposed.
- The main path drives other vendors' tools on the user's own subscriptions; the Terms leave it to
  the user to check that this is allowed by each provider.
- No compliance claims, no SLA, no refunds.
- The macOS build is signed and notarised per the README; the Windows installer is reported
  unsigned (secondary).

## Compared with Kucedr

- The same category as Rakazo and OpenBot: always-on general automation bots. Not an investigation
  tool.
- Kucedr's differences (per-tab Tor and proxy routes, the shield, capture) live in its own app and
  would not survive being wrapped as one of MausBot's engines: Kucedr's background runs refuse
  every route except direct, and MausBot's cloud computers are Boat Linux machines.
- Its partner programme is a paid listing aimed at vendors of models, compute and tools. Kucedr is
  none of these.

## Sources

- [Partners](https://mausbot.com/partners), [pricing](https://mausbot.com/pricing),
  [alternatives](https://mausbot.com/alternatives), [terms](https://mausbot.com/terms),
  [enterprise](https://mausbot.com/enterprise), [teams](https://mausbot.com/teams),
  [launch post](https://mausbot.com/blog/meet-mausbot)
- [GitHub repository](https://github.com/milind-soni/OpenMausBot)
- Secondary: [andrew.ooo review](https://andrew.ooo/posts/openmausbot-review-open-source-grok-bot-alternative/),
  [Best of JS](https://bestofjs.org/projects/openmausbot),
  [Product Hunt](https://www.producthunt.com/products/mausbot),
  [Enterprise DNA](https://enterprisedna.co/resources/ai-pulse/ai-pulse-2026-08-13-a-free-clone-of-a-200-paywalled-product-shipped-in-about-a-d)
