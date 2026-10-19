# Resend Email MCP Server

Local MCP server for sending email through the Resend API.

## Install in Kucedr

Use Node.js 22.19+ and npm 11.5.1+. From the repository root, copy the package into Kucedr's local
MCP directory and install its dependencies there. The commands below use a macOS/Linux shell
and assume the destination does not already exist:

```bash
mkdir -p ~/.kucedr/mcp/servers
cp -R resources/mcp/resend ~/.kucedr/mcp/servers/resend
npm ci --prefix ~/.kucedr/mcp/servers/resend
```

On Windows, place the folder under `%USERPROFILE%\.kucedr\mcp\servers\resend` and run
`npm ci` from that folder. The manifest launches `node --experimental-strip-types src/index.ts`;
Node.js must be available to the desktop process.

Open **Settings → MCP → Resend Email**, enter the environment values below, and click **Test**.
A successful test lists one `send_email` tool; it does not send email. The manifest requires
approval before tool execution. Use a disposable recipient when testing an actual send.

## Environment Values

Configure the client that launches this server to provide:

- `RESEND_API_KEY`: Required. Resend API key.
- `RESEND_API_BASE_URL`: Optional. Defaults to `https://api.resend.com`.

The API key is intentionally not stored in `mcp.json`.

## Tool

### `send_email`

Sends one email with Resend `POST /emails`.

Required arguments:

- `from`: Sender address, optionally with a friendly name.
- `to`: Recipient address or array of recipient addresses.
- `subject`: Email subject.

Content arguments:

- `html`: HTML body.
- `text`: Plain text body.
- `template`: Published Resend template object.

At least one of `html`, `text`, or `template` is required. `template` cannot be combined with `html` or `text`.

Optional arguments:

- `cc`
- `bcc`
- `reply_to`
- `headers`
- `attachments`
- `tags`
- `scheduled_at`
- `idempotency_key`

See the [application guide](../../../docs/APPLICATION.md#connect-external-capabilities) for MCP setup and
[SECURITY.md](../../../SECURITY.md) for credential storage and approval boundaries.
