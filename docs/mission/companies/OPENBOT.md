# OpenBot

Research note for [the bot-team review](../BOTS.md). Read 2026-11-27 from the sources at the end.
"Not stated" means the pages read did not say. This is OpenBot at openbot.run, by Nightly Labs. It
is not the CopilotKit project of the same name that MausBot's comparison page lists.

## At a glance

- **Company:** Synthetify Labs sp. z o.o., Trzebunia 513, 32-438 Trzebunia, Poland, KRS 0000895882;
  Polish law. Footer: "Made with ♥ in Poland."
- **People:** no team page. The launch post is by Norbert Bodziony (2026-09-14); the top committers
  are Aleksander Dygoń and Norbert Bodziony. The same people built the Synthetify DeFi project and
  the Nightly crypto wallet (secondary).
- **Product:** a source-available desktop app that runs a persistent team of AI agents on the
  coding-agent tools the user already pays for (Codex, Claude Code, Gemini, Grok and others), with
  optional paid hosted servers.
- **Customers:** individuals who already pay for an AI plan, small teams, agencies deploying agent
  environments for clients, companies wanting agents running 24/7.

## Mission

No mission statement. The launch post calls it "a free, source-available, local-first alternative
to Grok Bot".

## What they sell

- **Named agents,** each with instructions, a workspace and a conversation; agents message each
  other, hand off tasks and share files.
- **Providers:** Codex (through the Codex App Server), Claude (through the Claude Agent SDK), and
  Gemini, Grok, OpenCode, Cursor, Cline, Pi, Goose, Qwen Code and others over ACP; OpenAI-compatible
  endpoints; Ollama and LM Studio.
- **Fallback:** when a plan hits its limit or a provider is down, the agent moves to another
  provider and keeps its workspace and history.
- **Workflows** with approval gates; webhook routines; a team API; shared channels for people and
  agents.
- **Also in the README:** an embedded browser agents control, computer use on macOS, Windows and
  Linux, voice with local transcription, a browser password vault with TOTP, remote desktop,
  multi-tenant macOS hosting for agency clients, iOS and Android apps, a Chrome extension, a plugin
  marketplace.
- **Messaging:** Slack, Discord, Telegram and WhatsApp per the docs. The first three go through
  OpenBot's relay, which holds the Telegram bot token; WhatsApp uses an unofficial client that the
  docs warn WhatsApp may restrict.
- **Permissions:** agents run with `danger-full-access` and `approvalPolicy: never` after consent at
  first launch. The repository also has "Ask first", "Full access" and "Workspace only" modes.
- **Technically:** Electron with SolidJS, Bun and Node, SQLite; an account API on Cloudflare
  Workers; remote access over WebRTC through its own relay. The mobile app ships product analytics.
  Each release ships Sigstore signatures and SPDX software bills of materials.

## Prices

From the pricing page, in euros excluding VAT. Personal and non-commercial use: free, all features.

| Item | Monthly | Billed yearly |
| --- | --- | --- |
| Hosted server Starter (25 GB) | €30 | €24 |
| Hosted server Standard (75 GB, small team) | €50 | €40 |
| Hosted server Pro (150 GB) | €100 | €80 |
| Commercial licence Starter (1 member) | €10 | €7.20 |
| Commercial licence Team (2 members) | €25 | €18, then €10.80 per member |

- Commercial licences are "Free until December 1, 2026"; the page does not say which tiers.
- Credits are prepaid with no published price. Refund of 90% within two hours of purchase, plus the
  14-day withdrawal right for EU, UK and Turkish consumers.

## Partners and resale

- **No partner or white-label programme.**
- **Referral:** the referrer gets 10% of each paid invoice as Stripe credit that "has no cash value
  and is not paid out", up to US$20. Terms changed on 2026-11-20.
- **Commercial licence:** every client user needs a paid seat (5.1); embedding in a product for
  others needs written consent (5.2); notices, name and logo may not be changed (5.4, 6.3); private
  modifications may not be distributed commercially (6.2); no use to build a competing product
  (5.5), defined as one "whose primary function is to let users create, run, or coordinate AI
  agents" (1.11). Users may connect OpenBot to third-party software (5.7). The licensor may end the
  licence on 90 days' notice and raise fees with 30 days' notice.
- The code was Apache-2.0 up to 0.1.11, then PolyForm Noncommercial 1.0.0.

## Traction

- GitHub, 2026-11-27: created 2026-08-12; 11,517 stars, 1,119 forks, 5,825 commits; 4,775 open
  issues plus 469 open pull requests, most issues filed by the in-app reporter.
- First-day downloads of the last three releases: about 34.6k (v0.78), 27.6k (v0.79) and 22.7k
  (v0.80), probably including automatic updates. For v0.80 the macOS installer had 3,315 downloads
  in about 17 hours while the Mac updater file had 2,755, so many Mac downloads may be new installs.
- No user counts, revenue or testimonials on the site. Paid uptake is unproven until licences stop
  being free.

## Weak points

- Full host access by default; prompt injection turning into shell access is the main criticism in
  third-party write-ups (secondary).
- Built on other vendors' tools and subscriptions. Its own provider-terms page says Anthropic "has
  not confirmed" that subscription sign-in through OpenBot is permitted, while team members' turns
  "use your Claude sign-in".
- Restrictive licence for anyone who wants to build on it.
- Messaging depends on its relay or on an unofficial WhatsApp client.

## Compared with Kucedr

- Mostly a multi-agent coding and automation tool, already wider than Kucedr's general client
  (computer use, mobile, relay, hosting). Not an investigation tool.
- Kucedr's coding harness speaks the same app-server protocol it uses for Codex
  (`src/main/coding/harness/protocols.ts`); ACP is planned as 20.5 in
  [CODING.md](../../roadmap/CODING.md).
- Worth copying regardless of direction: signatures and software bills of materials on every
  release, for the signed-builds gate.

## Sources

- [OpenBot (Italian page)](https://openbot.run/it), [pricing](https://openbot.run/pricing),
  [teams](https://openbot.run/teams),
  [commercial licence](https://openbot.run/commercial-license),
  [terms](https://openbot.run/terms),
  [launch post](https://openbot.run/news/introducing-openbot),
  [compared with OpenClaw](https://openbot.run/compare/openclaw)
- [GitHub repository](https://github.com/nightly-labs/openbot),
  [messaging docs](https://github.com/nightly-labs/openbot/blob/main/docs/messaging.md), GitHub API
  for counts and release downloads
- Secondary: [AlphaSignal](https://alphasignal.ai/news/nightly-labs-openbot-runs-multiple-coding-agents-from-one-desktop-app),
  [Nightly wallet background](https://www.bybit.com/en/learn/defi/what-is-nightly-wallet)
