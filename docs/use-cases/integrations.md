# Extension and messaging use cases

Use services or test accounts that you control. Settings configuration alone is not proof that an agent can use an integration. See the [MCP reference](../FEATURES.md#mcp-servers) and [Apps guide](../APPS.md).

## Activate a skill

1. Import or enable a trusted skill in **Settings → Skills** and inspect its detail page for a valid manifest and instructions.
2. In a new chat, ask for a task that clearly matches that skill, or select it from the Home skill menu when available.

**Pass:** Tool activity shows skill activation and the answer follows its instructions. Record the exact skill name and any allowed-tool restriction.

## Call a generic MCP server

1. Add a test HTTP or local-command server in **Settings → MCP servers**; use the bundled demo package if available.
2. Open its details, enable it, run **Test**, and note a discovered tool name.
3. In a new chat ask the assistant to call that tool with harmless input.

**Pass:** Test reports the tool catalog and chat activity shows an `mcp__<server>__<tool>` call with a valid result. A saved catalog must exist for chat discovery.

## Open an imported app

1. Import a built, disposable app folder with a valid manifest in **Settings → Apps**.
2. Use **Open**, then **Details** to inspect its window settings.

**Pass:** The app opens in a separate window; opening it again focuses the same window. Remove the disposable app when finished. This test needs an actual built app; the repository does not currently bundle app source folders.

## Delegate to a remote agent

1. Add a test Agent2Agent endpoint in **Settings → Remote Agents** and use **Validate and save**.
2. In chat ask for a harmless task that matches one of the remote agent's advertised skills.

**Pass:** Validation lists the remote agent and skills, and chat activity shows delegation with a returned result. An unreachable endpoint is a setup block.

## Receive a Telegram reply

1. Configure reply models and a test bot token under **Settings → Channels → Telegram**. Allow only your test sender ID.
2. From that account, send the bot `Kucedr Telegram test <RUN>: reply with this marker.`

**Pass:** The allowed sender receives a reply containing the marker, and Kucedr records the bot conversation. Remove the test token or sender rule afterward. The channel detail page does not show live connection status.
