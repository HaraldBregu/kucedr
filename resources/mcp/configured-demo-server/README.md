# Kucedr Configured Demo MCP Server

A dependency-free local MCP server demonstrating both server configuration values and tool inputs.

## Required server values

After copying the package, open **Settings → MCP → Kucedr Configured Demo** and configure:

- `DEMO_COMPANY`
- `DEMO_CURRENCY` — an ISO 4217 currency code such as `EUR`, `USD`, or `GBP`
- `DEMO_TAX_RATE` — a numeric percentage stored as a string
- `DEMO_SIGN_OFF`

The included values are non-secret examples. Do not commit real credentials to this manifest.

## Install and test

1. Copy this `configured-demo-server` folder to `~/.kucedr/mcp/servers/kucedr-configured-demo`.
2. Open **Settings → MCP** and select **Kucedr Configured Demo**. The registry rescans local packages when the page loads.
3. Click **Test**. Kucedr should report three tools.

The Settings page currently has no local-package upload action. Copy the package into the user MCP
directory before opening Settings; source folders are not scanned directly. No dependency
installation is needed; the server uses Node.js built-ins.

## Tools and call-time inputs

- `configuration_summary` reads the server values and requires no arguments.
- `create_quote` requires `customer`, `item`, `quantity`, and `unitPrice`.
- `compose_customer_message` requires `recipient`, `subject`, and `body`.

All tools are local, read-only demonstrations and require approval before execution.

See the [application guide](../../../docs/APPLICATION.md#connect-external-capabilities) for MCP setup and
[SECURITY.md](../../../SECURITY.md) for local-process and approval boundaries.
