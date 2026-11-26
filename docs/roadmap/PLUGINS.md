# 8. Plugins: catalogue, sign-in and paid plugins

Part of the [Roadmap](README.md). Status: proposal, long term.

Plugins that can sign the user in to a service (OAuth) and plugins that can be paid for.

## What exists today

- Plugins contribute apps, connector servers, providers, skills and modes
  ([Plugins](../PLUGINS.md)). The catalogue, updates, the install confirmation and plugin
  permissions are designed in [Plugin system](../PLUGIN_SYSTEM.md) but not built.
- That design lists paid plugins as a non-goal for its first version, and puts self-serve
  publishing and package signing in its later phases.
- Kucedr already runs OAuth sign-in for connector servers and keeps the tokens sealed
  (`src/main/mcp/mcp_oauth_create_provider.ts`, `src/main/mcp/mcp_oauth_callback.ts`). The plugin
  design notes that OAuth sign-in for a plugin's remote servers is not supported yet.
- Plugin settings can already hold sealed password fields
  (`src/main/plugins/plugins_save_settings.ts`).
- The command-line tool installs plugins to a separate folder with an older manifest version that
  the desktop app does not read.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 8.1 | Plugin catalogue | Browse, install with a confirmation listing what the plugin adds, and update plugins | [Plugin system](../PLUGIN_SYSTEM.md), section 10 | L |
| 8.2 | Sign-in for plugin servers | A plugin's remote server that needs OAuth gets a Connect button; tokens are sealed like other connectors | The existing connector sign-in | S–M |
| 8.3 | Sign-in declared by a plugin | A plugin names the service it needs (sign-in address, what it asks for, a public client id). Kucedr runs the sign-in in the system browser and keeps the tokens; the plugin receives short-lived access only | The app bridge and permissions in [Plugin system](../PLUGIN_SYSTEM.md), section 9, not yet built | M |
| 8.4 | Kucedr identity for plugins | With the user's consent, a plugin can confirm which Kucedr account is using it, so the author's server can recognise a customer | The existing account; needs a server function | M |
| 8.5 | Paid plugins sold by the author | The plugin is free to install; the author's own service sells the subscription and the plugin signs in to it through 8.3. Kucedr handles no money; the catalogue says a paid account is required | 8.3 | S |
| 8.6 | Paid plugins sold in the catalogue | A price in the catalogue, purchase through the same checkout as [Payments](PAYMENTS.md), and download and updates only for buyers | 8.1, 8.4, payments (9.2, 9.3) | L |
| 8.7 | Publisher accounts and payouts | Authors register, are verified, sign their packages and receive their share of sales | Later phases 3 and 4 of [Plugin system](../PLUGIN_SYSTEM.md) | L |
| 8.8 | App bridge and settings forms | Plugin apps can read the theme, insert text in the composer and prompt the agent; each plugin gets a settings form generated from its manifest | Designed in [Plugin system](../PLUGIN_SYSTEM.md), partly built | M |
| 8.9 | Honest catalogue | Models listed without a working adapter are hidden or labelled | Built 2026-11-26: the built-in audio catalog contains only the six ElevenLabs models with executable adapters. Provider and feature references no longer list unsupported Google, Kling, MiniMax or Pika audio models as catalog entries | S |

What a plugin may reach on the network is covered by the [Network shield](SHIELD.md), 13.4.

## How sign-in for plugins is kept safe

- **No secrets in a plugin.** The plugin design already says manifests carry no secrets. Sign-in
  uses the method made for apps that cannot keep a secret (PKCE); a plugin that needs a client
  secret keeps it on its own server.
- **Kucedr holds the tokens.** Long-lived tokens stay in sealed storage and are never handed to the
  plugin. The plugin gets short-lived access, limited to the addresses it declared.
- **Shown before install.** The services a plugin signs in to, and whether it needs a paid account,
  appear in the install confirmation.
- **Removed with the plugin.** Uninstalling a plugin deletes its tokens. With separate sign-ins per
  workspace ([Multiple workspaces](WORKSPACES.md), 10.3), each workspace signs in on its own.

## How a paid plugin is enforced

A plugin is files on the user's disk; once downloaded it can be copied. What can be enforced:

- download and updates only for accounts that bought it (8.6);
- for a plugin backed by the author's server, the server checks the buyer through 8.4.

There is no copy protection, and the roadmap does not plan any.

## Open decisions

- **Order.** Recommended: 8.2, then 8.3, then the catalogue (8.1), then 8.5. That gives paid plugins
  without Kucedr handling money. 8.6 and 8.7 only when outside authors want Kucedr to make the sale.
- **Payment provider.** If 8.6 is wanted, the provider chosen in [Payments](PAYMENTS.md) must be
  able to pay third-party sellers. Not every provider does; check before choosing.
- **Business terms.** Revenue share, review policy for paid plugins, refunds, and who is the legal
  seller.
- **Needed first.** Signed builds ([Distribution and trust](DISTRIBUTION.md), 6.1), package signing
  and publisher identity, and one manifest version shared by the desktop app and the command-line
  tool.
