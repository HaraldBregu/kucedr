# Gmail SMTP MCP Server

Local MCP server for sending email through Gmail SMTP.

## Install in Kucedr

Use Node.js 22.19+ and npm 11.5.1+. From the repository root, copy the package into Kucedr's local
MCP directory and install its dependencies there. The commands below use a macOS/Linux shell
and assume the destination does not already exist:

```bash
mkdir -p ~/.kucedr/mcp/servers
cp -R resources/mcp/gmail-smtp ~/.kucedr/mcp/servers/gmail-smtp
npm ci --prefix ~/.kucedr/mcp/servers/gmail-smtp
```

On Windows, place the folder under `%USERPROFILE%\.kucedr\mcp\servers\gmail-smtp` and run
`npm ci` from that folder. The manifest launches `node --experimental-strip-types src/index.ts`;
Node.js must be available to the desktop process.

Open **Settings → MCP → Gmail SMTP Email**, enter the environment values below, and click **Test**.
A successful test lists one `send_email` tool; it does not send email. The manifest requires
approval before tool execution. Use a disposable recipient when testing an actual send.

## Environment Values

Configure the client that launches this server to provide:

- `GMAIL_SMTP_USER`: Required. Full Gmail or Google Workspace email address.
- `GMAIL_SMTP_PASSWORD`: Required. Gmail app password.
- `GMAIL_SMTP_HOST`: Optional. Defaults to `smtp.gmail.com`.
- `GMAIL_SMTP_PORT`: Optional. Defaults to `587`.
- `GMAIL_SMTP_SECURE`: Optional. Use `true` for SSL on port `465`; use `false` for STARTTLS on port `587`.

Credentials are intentionally not stored in `mcp.json`.

## Tool

### `send_email`

Sends one email through Gmail SMTP.

Required arguments:

- `from`: Sender address, usually the same Gmail or Workspace account.
- `to`: Recipient address or array of recipient addresses.
- `subject`: Email subject.

Content arguments:

- `text`: Plain text body.
- `html`: HTML body.

At least one of `text` or `html` is required.

Optional arguments:

- `cc`
- `bcc`
- `reply_to`

See the [application guide](../../../docs/APPLICATION.md#connect-external-capabilities) for MCP setup and
[SECURITY.md](../../../SECURITY.md) for credential storage and approval boundaries.
