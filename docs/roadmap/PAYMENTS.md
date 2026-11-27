# 9. Payments and paid services

Part of the [Roadmap](README.md). Status: proposal.

A way to sell services from inside the app, starting with storage.

## What exists today

Nothing for billing. Accounts run on Supabase (`src/main/cloud/supabase/auth.ts`, the `profiles`
table). Storage is bring-your-own: the user supplies their own S3 bucket and keys
([CLOUD.md](../CLOUD.md)). The `kucedr://` link scheme is already registered for sign-in
(`src/main/index.ts`), and four server functions under `supabase/functions` already hand out narrow
upload and download grants.

Before there is something to sell, Kucedr needs a storage service it hosts itself. Today there is
no hosted product, only the user's own bucket.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 9.1 | Kucedr Storage | Backup and sync that work after sign-in, with no bucket or keys to configure | The existing grant functions pointed at a bucket the distributor owns; per-user quota | L |
| 9.2 | Plans and checkout | A Plans page in Settings; "Upgrade" opens the payment provider's hosted checkout in the system browser and returns to the app through a `kucedr://` link | Existing account, deep link, Settings → Cloud | M |
| 9.3 | Entitlements | The app knows what the account has paid for (plan, storage limit, renewal date) and unlocks it; works offline from the last known state | One server table written only by the payment provider's webhook | M |
| 9.4 | Manage subscription | Change plan, update card, cancel, download invoices, all on the provider's hosted portal | Provider portal link; no billing screens to build | S |
| 9.5 | Further paid services | Hosted AI access (use the app without bringing a model key), hosted search, larger limits | Same entitlements; each is its own product | L each |
| 9.6 | Desk licence | A yearly per-seat licence for firms using the [investigation desk](../mission/TARGET.md): commercial terms with an acceptable-use clause, support, encrypted case backup and help with the integrity note. No feature of the MIT app is locked | 9.2–9.4; encrypted backup (1.5). Proposal 2026-11-27 | M |

Paid plugins use the same checkout and entitlements; see [Plugins](PLUGINS.md), 8.6.

## How it fits together

- The payment provider's secret keys live only in server functions. The desktop app is open source
  and never holds them, and never sees card details.
- Flow: the app asks a server function for a checkout link for the signed-in account; the user pays
  in the browser; the provider calls a webhook function; the webhook updates the entitlements table;
  the app refreshes entitlements when the `kucedr://` link returns and at each launch.
- The server, not the app, enforces limits (the upload grant function checks quota), because the
  app can be modified by anyone.

## Kept out on purpose

Custom card forms, invoice screens, coupons, team billing, usage-based metering. The provider's
hosted checkout and portal cover the first four; metering waits for a service that needs it.

## Open decisions

- **Which provider.** Recommended: a merchant of record (Paddle or Lemon Squeezy), which is the
  legal seller and handles VAT and sales tax in every country. Stripe is the alternative; it gives
  more control, but tax registration and remittance stay with the seller. This is a business and tax
  choice; check current terms and fees before settling. If paid plugins sold in the catalogue are
  wanted later, the provider must also be able to pay third-party sellers.
- **What is sold first.** Recommended: one storage plan with one price, to prove the flow.
- **Encrypted backup before hosted storage** ([Privacy](PRIVACY.md), 1.5). Once Kucedr holds user
  files, "we cannot read them" is the selling point and the protection.
- **Paperwork.** Terms of service, a privacy policy and a refund policy are needed before the first
  sale. [LANDING_PAGE.md](../LANDING_PAGE.md) currently forbids a pricing section.
- **Server changes.** This needs new server functions and a database migration.
- **App stores.** The app is not in the Mac App Store, so Apple's in-app purchase rules do not
  apply. They would if it is ever listed there.
