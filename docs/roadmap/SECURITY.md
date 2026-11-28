# 21. Security hardening

Part of the [Roadmap](README.md). Status: proposal.

The items from the [Security audit](../SECURITY_AUDIT.md) and the permission reviews that are still
open. The audit's own status table is out of date: [PERMISSIONS_PLAN.md](../PERMISSIONS_PLAN.md)
records several of its items as fixed since. The list below was read from those docs on 2026-11-19;
only #17, #22 and #24 were checked in code. Rows 21.10–21.12 are the open findings of the
[Chat agent permissions review](../PERMISSIONS_SECURITY.md), checked in code and in the built app on
2026-11-22.

## Open items

| # | Item | What it means for the user | Where it is handled | Size |
| --- | --- | --- | --- | --- |
| 21.1 | Voice runs actions without asking (audit #7) | A spoken request can change files or send data with no confirmation | [Voice](VOICE.md), 19.3 | M |
| 21.2 | Workspace skills override trusted ones (audit #11) | A file in the workspace can replace a built-in skill of the same name | Decide: trusted skills win, or the user confirms | S |
| 21.3 | Restore can plant code (audit #17) | Restoring a backup can bring in plugins, skills or connector servers; only settings, providers and storage are protected (`src/main/storage/storage_protected.ts`) | Built 2026-11-27 for backup restore (`src/main/backup/hold.ts`): `plugins`, `mcp` and `skills` are copied aside before a restore; any the restore changed are swapped back at once and used only if the user picks **Use restored**. Checked with the hold logic run against a stubbed dialog, not in the app with a real bucket. Left: cloud version sync (`storage/cloud/catchup.ts`) can still add new files to those folders, and `coder` harness homes are not held | M |
| 21.4 | Plugin download checks (audit #19) | Built. Desktop catalogue installs verify SHA-512. Catalogue and direct URL installs check the archive before extraction and reject packages over 256 MiB unpacked or 10,000 entries. | [Plugin installation](../PLUGINS.md#installing) | S |
| 21.5 | Browser reaches private hosts (audit #21) | Mostly fixed 2026-11-24: public pages in the browser pane cannot reach the local network. Left: a DNS-rebinding check | [Network shield](SHIELD.md), 13.5. DNS-rebinding check built 2026-11-27 (`src/main/shield/rebound.ts`) for direct and private tabs; checked in the app | S |
| 21.6 | No task frequency limit (audit #22) | Fixed 2026-11-25: a task runs at most once every 5 minutes (checked when saved and when scheduled) and at most 3 tasks run at once | [Automation](AUTOMATION.md), 16.5 | S |
| 21.7 | Broad content policy (audit #24) | Partly fixed 2026-11-25: the unused script CDN and websocket sources are gone and remote images wait for a click. The app window still allows inline scripts and `https:` images, and `local-resource:` serves any absolute path (`src/renderer/index.html`, `src/main/protocol.ts`) | [Network shield](SHIELD.md), 13.7 | S |
| 21.8 | Build hardening (audit #18, #25) | Unsigned builds, permissive entitlements, unsigned updates | [Distribution and trust](DISTRIBUTION.md), 6.1 | L |
| 21.9 | Audit kept current | The audit table matches the code, with each item marked fixed, open or decided | [Quality](QUALITY.md), 22.4 | S |
| 21.10 | Sandboxed commands reach any host (permissions #4) | A command the agent runs can send data to any internet host. Local ports were closed 2026-11-25 (`allowLocalBinding: false`): a sandboxed command can no longer listen on a port or reach a service on `localhost`, and needs `elevated`, which asks the user, to do so. The runtime applies this on macOS only. File reads of known secrets are already denied. Step 1 built 2026-11-27: the sandbox proxy no longer dials this machine, the local network or cloud metadata. The runtime's `deniedDomains` matches names only (no address ranges, no lookup), so `allowedDomains` is now empty and every host goes to a filter (`src/main/agent/sandbox/egress.ts`, passed as the runtime's host callback, no prompt): it refuses names `shield/local.ts` marks as local, names that do not resolve, and names with any private, loopback, link-local or metadata address (`private.ts`). The filter reads the host the way the proxy dials it (URL parsing), so `0177.0.0.1` counts as `127.0.0.1`: before this, a raw `CONNECT 0177.0.0.1` passed the filter and reached a `127.0.0.1` server (checked against the runtime directly, and blocked after the fix). Local development still needs `elevated`. The network config is part of the sandbox fingerprint. Checked in the built app with a mock model running `curl` through a background task: through the HTTP and SOCKS proxy, `127.0.0.1`, `localhost`, `127.1`, `10.0.0.1`, `169.254.169.254`, `metadata.google.internal` and a name mapped to `192.168.1.50` got 403 and never reached the local server; a name mapped to a public address got 200, and `https://example.com` got 200. With the old config the same proxy reached `127.0.0.1` (checked against the runtime directly). Limits: the filter's lookup and the proxy's connection resolve separately, so a name that flips between the two passes; the model sees the refusal as "user denied" | Left (step 2): a network allow-list, designed with [Network shield](SHIELD.md), 13.4 | S |
| 21.11 | Assistant edits its own prompt (permissions #7) | Identity, soul and user feed every future system prompt. After setup each change asks once, but the card shows only the new values, not what they replace; during first-run setup the changes run without asking | Decide. Recommended: show a diff of old and new values in the approval card and in chat | S |
| 21.13 | MCP tools trusted as read-only (audit #14) | Fixed 2026-11-27: a server's `readOnlyHint` no longer lets a tool run without asking; only the server's "never ask" setting or the user's own choice does. Stored choices already reset when a tool's definition changes. Background tasks still run MCP tools set to ask without asking (`agent_profiles.ts`) | `src/main/mcp/mcp_tool_permission.ts` | S |
| 21.12 | Redaction hides length (permissions #8) | Fixed 2026-11-26: secret-looking values show `[redacted, N chars]` in approval cards. Bash `env` values remain visible | `redact_approval_input.ts`, called with the tool name | S |
| 21.14 | Sensitive data sealed before it reaches the model | Passwords, keys, card and account numbers, and personal details the user marks (names, emails, phone numbers, addresses) never leave the machine in readable form. One module on the way out replaces each value in messages, attachments and tool results with a placeholder; the real value is kept encrypted on the machine and put back locally in the reply and in tool arguments, so the answer and the actions still use it. Added 2026-11-28 | Nothing on the model path today. To reuse: the secret patterns in `agent/knowledge/secrets.ts`, the stored-key match of the secret guard ([Network shield](SHIELD.md), 13.3), the vault key ([Privacy](PRIVACY.md), 1.3). Applies to every provider from one place, with no provider code in `src` | L |

## Open decisions

- **21.1, 21.2 and 21.3 are recorded as "decision" in the audit.** Recommended: ask before
  side-effect actions in voice, trusted skills win, and restored code stays disabled until the user
  confirms it.
- **21.10 and 21.11 are product decisions.** Local binding for sandboxed commands is off since
  2026-11-25; design the network allow-list with [Network shield](SHIELD.md). Recommended: show a
  diff for prompt self-edits, and decide whether first-run setup should ask too.
- **21.14: placeholders, not ciphertext.** A model cannot work on text it cannot read, so values
  encrypted in the prompt would be useless to it. Recommended: swap each value for a typed
  placeholder (`[EMAIL_1]`, `[CARD_1]`) and keep the encrypted mapping per chat on the machine. Real
  end-to-end encryption exists only with providers that run the model in a confidential enclave,
  which is a separate, later choice; a local model ([Local](LOCAL.md)) needs neither.
- **21.14: what counts as sensitive.** Recommended: secrets always (patterns and stored keys);
  personal details by pattern, on by a switch in Settings → Privacy; free-form detection of names
  with a local model only later, since it adds a model dependency. Also to settle: what the user
  sees in chat (the real value, with a mark that it was hidden from the model), whether the model's
  reasoning suffers when it needs the value itself (arithmetic on an amount, a domain in an email),
  and whether voice and images are covered.
- **Order.** 21.3 before hosted storage ([Payments](PAYMENTS.md), 9.1), since restore becomes a
  common path once backup is a product.
