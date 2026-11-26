# Mission

Status: proposal, written 2026-11-26 from the owner's direction: "very secure, private, encrypted,
secure. the app will navigate in privacy on web, will be free without guardrails". Nothing here is
decided. Statements about Kucedr come from a read of `dev` at `8a3abf22b5`; nothing was run.
Market statements come from search results read the same day and are secondary unless marked.

## Summary

- **The mission is Kucedr's character, not a new market.** The earlier documents found that privacy
  earns no price premium ([DIRECTIONS.md](DIRECTIONS.md#what-every-track-found)). The mission does
  not contradict that: it fixes what Kucedr is for everyone, and the studio and due-diligence tests
  stay as the answer to who pays.
- **Proposed line:** *Kucedr is a free, open-source AI agent that works only for you. Your data is
  encrypted on your machine, your browsing stays private, you choose the model, and the app sets no
  rules on what you may ask.*
- **"Without guardrails" is already true in the one sense that holds up.** The app's prompts, modes
  and skills carry no content rules, and any model can be used, including uncensored local ones.
  Every stop in the code protects the user from the agent, a web page or a third party. Those stay:
  removing them would contradict "very secure".
- **Most of the building is already in the roadmap.** The mission moves up signed builds,
  encryption on by default, untrusted page marking, tracker blocking, a real Tor check and local
  models, and moves down computer use, integrations, the coding page and the plugin catalogue.
- **The words cannot be used yet.** "Encrypted" waits for a verified release with signed builds,
  "private browsing" needs a local model to cover the agent's reading, and "anonymous" stays banned.

## 1. The mission in five promises

| Promise | What it means | What it does not mean |
| --- | --- | --- |
| Secure | Signed builds; the agent runs sandboxed and asks before risky actions; web pages are treated as untrusted; open security items closed | Fewer approvals |
| Private | No account needed, no telemetry, nothing leaves the machine except to a recipient the user chose; the app shows what was sent where | That a hosted model provider does not see the prompt |
| Encrypted | Chats, memory, attachments and backups encrypted on disk and in backup, keys in the OS keychain, app lock | End-to-end encryption with a cloud model |
| Private on the web | A route per tab (direct, private, proxy, Tor) with no fallback, the shield on, trackers blocked | Anonymity, or Tor Browser's fingerprint protection |
| Free | The app costs nothing, is MIT, and adds no content rules; the user picks any model, local or hosted | Free use of paid hosted models |

## 2. The two ambiguous words

**Free.** Free of charge holds for the app and for local models through the keyless Ollama plugin;
hosted models are paid by the user to the provider. Free as in freedom is already the documented
position: MIT core, no model allow-list, a Custom provider for any OpenAI-compatible endpoint,
editable persona. Recommended: both, and say which applies where.

**Without guardrails.** Two readings, which the code separates cleanly:

| Reading | State today | Verdict |
| --- | --- | --- |
| (a) The app adds no content rules and runs any model | True. The base prompt (`src/main/agent/system/system_add_base_prompt.ts`) has no blocked topics or refusal instruction; its safety lines are about actions and treating tool output as data. A term search of `src/`, `resources/plugins` and `resources/templates` found no content restriction authored by the app. Ollama models are discovered with no name filter (`resources/plugins/ollama/models/auto/manifest.json`) | Adopt. Nothing to remove |
| (b) Fewer approvals, prompts and blocks | Every stop is a protection: the sandbox, protected paths (`src/main/agent/permissions/protected.ts`), the shield and secret guard (`src/main/shield`), held downloads, site permission denial, and hard approvals for recorders, profile edits, agent-opened Tor tabs and host commands | Reject. It contradicts "secure" |

Limits of reading (a):

- **Hosted providers keep their own rules.** A refusal from Anthropic, OpenAI or xAI streams to the
  user as text, and the app cannot remove it. "No guardrails" is fully true only with a local or
  self-hosted model.
- **Local-only users lose voice, Coder and media generation.** No bundled manifest has a local
  model for them. The promise covers chat, agent tools and the browser.
- **Uncensored local models are weaker at tool use**, and page text reaches the model unmarked
  (13.10 not built). In that setup the sandbox, protected paths, secret guard and approvals are the
  only defence against a hostile page, which is why reading (b) is rejected.
- Users who want less friction already have settings for it, not removals: trusted folders, tools
  set to Allow, connectors set to never ask.

Two leftovers to settle: the matrix mode's description promises "protecting people from harm" that
its prompt does not contain, and the memory module drops sensitive categories (health, religion,
politics, card numbers) by a fixed pattern (`src/main/memory/private.ts`). The second is a privacy
protection, not a content rule, and stays.

## 3. Where Kucedr stands

| Promise | Built | Missing | Roadmap |
| --- | --- | --- | --- |
| Secure | Sandbox with no off switch, protected paths, per-tool permissions, shield, held downloads, site permission denial | Signed and notarised builds; untrusted content marking; sandboxed commands reach any host (`allowedDomains: ['*']`); restore can plant code; inline scripts in the app window; unsigned updates | [6.1](../roadmap/DISTRIBUTION.md), [13.10](../roadmap/SHIELD.md), [21.3, 21.7, 21.8, 21.10](../roadmap/SECURITY.md) |
| Private | Sealed keys (1.2); Privacy Mode through a local SOCKS5 proxy (1.10); setup with a local model and no key (15.1); account creation can be skipped; no telemetry | A privacy centre; a network view; a local-only switch; local knowledge (indexing still uses a remote embedding service); model downloads; a built-in runtime; Privacy Mode pauses shell, fetch, background browsing, Tor tabs, stdio MCP and plugin scripts | [1.1](../roadmap/PRIVACY.md), [13.8, 13.9](../roadmap/SHIELD.md), [15.2, 15.3, 15.5](../roadmap/LOCAL.md) |
| Encrypted | AES-256-GCM vault for chats, memory, health notes and mode state, key sealed by the OS keychain (`src/main/vault`), switch in Settings → Privacy, added 2026-11-25; app lock (`src/main/lock`); backup passphrase path (`src/main/backup/fork.ts`) | Vault off by default and not verified on a release; the lock encrypts nothing; full protection needs signed builds; private chat; encrypted sync | [1.3–1.6, 1.9, 1.11](../roadmap/PRIVACY.md) |
| Private on the web | Direct, private, proxy and Tor routes per tab with no fallback; WebRTC leak closed; tracking parameters stripped; local network block | Tor checked against a fake proxy only; tracker and ad blocking; the rest of browsing hygiene; Tor for background runs; any fingerprint work | [11](../roadmap/TOR.md), [12](../roadmap/VPN.md), [13.1, 13.6](../roadmap/SHIELD.md) |
| Free, no content rules | MIT; no content rules; any model through bundled plugins, Ollama or a Custom endpoint | A checked run with a real local model using tools and the browser; voice and media have no local model | [15](../roadmap/LOCAL.md) |

One point needs its own line: when the agent reads a page through a Tor tab, the page text still
goes to the model provider. Private agent browsing therefore needs a local model, or a plain
statement that the provider sees what the agent reads.

## 4. What others offer

| Product | What it is | Privacy claim | Price signal |
| --- | --- | --- | --- |
| Venice | Cloud chat with open models, marketed as private and uncensored | Prompts not stored on its servers | Free with daily limits; Pro $18 a month, higher tiers to $200 |
| Proton Lumo | Cloud assistant from Proton | Zero-access encrypted history, no training; critics note the server must read the prompt to answer | Free; Plus $12.99 a month or $119.88 a year |
| Confer | Cloud chat from Signal's founder, launched December 2025 | Prompts decrypted only inside a trusted execution environment; keys derived from a passkey; open source | Free tier; models not disclosed |
| Duck.ai | DuckDuckGo's chat over third-party models | No account, IP removed, providers under zero retention, history kept on the device | Free with a daily limit; better models in a $9.99 bundle |
| Brave Leo | Assistant inside the Brave browser | No login, no training; trusted-execution routing in the test build only | Free; premium models paid |
| LM Studio, Jan, Msty | Desktop apps for local models | Everything local | Free; Msty has paid features |

What this says for Kucedr:

- **Private and uncensored has a paying audience**, and Venice shows it at consumer prices. It is a
  cloud service: the user trusts Venice. Kucedr can offer the same freedom with nothing to trust
  but the user's own machine, when a local model is used.
- **Encrypted cloud AI is moving to trusted execution** (Confer, Brave, partly Lumo). Kucedr can
  connect to such services as providers; it should not try to run its own.
- **Local model apps are free and do not browse or act.** None found combines a local agent, a
  private browser with Tor and proxy routes, encryption at rest, no account and no content rules.
  That combination is the claim to defend.
- **None of this changes the earlier finding that privacy earns no premium.** The cheapest products
  above are free, and the paid tiers sell model access, not privacy.

## 5. How it fits the earlier documents

- **Directions.** The mission sits under them, not beside them. As a product for everyone it is
  [PRODUCT.md](PRODUCT.md#3-directions-considered) direction 3 ("No") plus the open general client
  in [DIRECTIONS.md](DIRECTIONS.md#3-paid-extras-on-the-open-general-client) ("Means, not mission").
  As a set of properties it is what DIRECTIONS.md already says both tested directions need:
  encryption at rest, app lock, signed builds. Recommended: adopt it as the character; keep the
  three-week buyer test as the commercial decision.
- **Money.** Free of charge leaves optional extras: encrypted backup and sync, hosted private model
  access for people without keys, a supporter or commercial licence, support. Individuals do not
  repay acquisition ([ECONOMICS.md](ECONOMICS.md)), so the extras fund the work only if the
  audience grows well past today's.
- **Rules that change.** PRODUCT.md rule 6 ("Legitimate work only. Each case states its purpose")
  and the purpose-per-case safeguard in its section 10 conflict with reading (a). Neither is built.
  Recommended: drop the purpose requirement; keep not bundling people-search or data-broker
  connectors, which is a choice of what ships, not a rule on the user.
- **Rules that stay.** The accuracy rules in [LANDING_PAGE.md](../LANDING_PAGE.md) ("fully private",
  "end-to-end encrypted", "on-device AI" are banned) and PRODUCT.md's "never anonymous" stay. The
  mission is phrased inside them.

## 6. Order of work

| Phase | Contents | Outcome |
| --- | --- | --- |
| 1. Trust the machine | Signed and notarised builds and updates (6.1, 21.8); vault verified and on by default for new installs (1.3); app lock tied to the vault (1.4, 1.11); untrusted content marking (13.10); sandbox egress limited (21.10, 13.4); restore and window fixes (21.3, 21.7) | "Encrypted" and "secure" can be said on a release |
| 2. Private by default | Real Tor check and Tor for background runs (11); tracker and ad blocking (13.1); browsing hygiene (13.6); network view and privacy centre (13.8, 1.1); local-only switch (13.9); Privacy Mode paths re-enabled behind a verified transport (1.10) | The user can see and limit everything that leaves |
| 3. Free and local | Model downloads (15.2); local knowledge (15.3); built-in runtime (15.5); private chat (1.6); encrypted backup and sync (1.5, 1.9) as the optional paid service | The whole agent runs with no key and no account |

Moves down: computer use (24), integrations (17), the coding page (20), the plugin catalogue (8),
browser import beyond what is built (23). Rewrite the README opening and the landing page
positioning after phase 1, not before.

## 7. Words and when they can be used

| Claim | Allowed when |
| --- | --- |
| "Your chats are encrypted on your computer" | Phase 1 is on a signed release and checked |
| "No account. No telemetry." | Now, after a check of every outbound call on a clean install |
| "The app sets no rules on what you ask" | Now |
| "Uncensored" | Only for local models, and naming that hosted providers keep their rules |
| "Sites don't see your address on Tor and proxy tabs" | After the real Tor check |
| "Private browsing for the agent" | Only with a local model, or with the provider disclosure |
| "Anonymous", "untraceable", "end-to-end encrypted", "fully private" | Never |

## 8. Risks

| Risk | Answer |
| --- | --- |
| "No guardrails" read as an invitation to misuse, and press to match | Say what it means: no content rules from the app, protections kept. A local app cannot police its users; the docs say so, and the MIT licence disclaims liability |
| Hosted providers closing the user's account | The user's own key and the provider's terms; say so in setup |
| Hostile pages steering an unfiltered agent | 13.10 first; the sandbox, secret guard and approvals stay |
| Claims ahead of the code | Section 7 and the existing accuracy rules |
| No revenue | The buyer tests in DIRECTIONS.md continue; extras are optional |
| One maintainer | Fewer areas: the moves down in section 6 |

## Open decisions

- **Adopt the mission as character or as replacement.** Recommended: character. The buyer tests
  stay the commercial decision.
- **"Without guardrails".** Recommended: reading (a) only, worded as "no content rules from the
  app; protections that guard you, not judge you".
- **Vault on by default.** Recommended: on for new installs once verified. This reverses
  [PRIVACY.md](../roadmap/PRIVACY.md#open-decisions)'s opt-in recommendation; run-trace analysis
  and plain-file backup then read through the app.
- **Fingerprinting.** Recommended: still out of scope; say that Kucedr's browser is easier to
  recognise than Tor Browser wherever a route is chosen.
- **PRODUCT.md rule 6.** Recommended: drop the purpose requirement, keep the connector choice.
- **The matrix mode description.** Recommended: align it with its prompt.

## Not verified

- Nothing was run. No chat with a real local model, uncensored or not, used tools or the browser.
- Whether a local model works while Privacy Mode is on: the transport has no loopback exception.
- The vault, app lock and backup passphrase were read in code only, not exercised on a release.
- Every market figure in section 4 comes from search results and reviews, not the vendors' pages.
  Venice's prices disagree between sources; Confer's models are not disclosed.
- No source was found on consumer willingness to pay for local, uncensored AI as opposed to hosted.

## Sources

Read 2026-11-26; all secondary.

- Venice: [usagepricing.com](https://www.usagepricing.com/blueprint/venice), [Decrypt](https://decrypt.co/354364/what-is-venice-ai-the-privacy-focused-chatbot)
- Proton Lumo: [TechRadar review](https://www.techradar.com/pro/lumo-ai-review), [Neowin](https://www.neowin.net/news/proton-launches-lumo-privacy-focused-ai-assistant-with-encrypted-chats/), [Proton pricing page](https://proton.me/lumo/pricing) (not read directly)
- Confer: [TechCrunch, 2026-01-18](https://techcrunch.com/2026/01/18/moxie-marlinspike-has-a-privacy-conscious-alternative-to-chatgpt), [Gizmodo](https://gizmodo.com/signals-founder-turns-his-attention-to-ais-privacy-problem-2000709897)
- Duck.ai: [DuckDuckGo help](https://duckduckgo.com/duckduckgo-help-pages/duckai), [TechRadar review](https://techradar.com/pro/duck-ai-review)
- Brave Leo: [The Register, 2025-11-22](https://www.theregister.com/2025/11/22/brave_leo_trusted_execution_environment/), [TechRadar review](https://www.techradar.com/pro/brave-leo-ai-review)
- Local apps: [LM Studio review](https://dev.to/nishilbhave/lm-studio-in-2026-download-models-run-local-llms-vs-ollama-lch), [Jan review](https://dev.to/jovan_chan_9500711396d4e6/jan-ai-review-2026-13ei), [Msty vs Ollama vs LM Studio](https://localaimaster.com/blog/msty-vs-ollama-vs-lm-studio)
