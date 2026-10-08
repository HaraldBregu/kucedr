# Microsoft MCP setup

Create a Microsoft Entra app registration to connect Kucedr to Outlook Mail, Outlook Calendar,
Teams, OneDrive, SharePoint, Word, and Microsoft 365 Search. One client app registration can
serve all seven connections. Microsoft Learn needs no app registration or credentials.

This guide covers the Microsoft endpoints already bundled in
[`resources/providers/microsoft/manifest.json`](../resources/providers/microsoft/manifest.json).
Microsoft currently classifies these application-specific servers as preview integrations for
backward compatibility and recommends consolidated Work IQ MCP for new projects. See the
[Microsoft compatibility notice](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-word-tools).

## Before you start

Use a Microsoft Entra work or school account with access to your organization's Microsoft 365
services. Work IQ MCP requires a Microsoft 365 Copilot license, permission to register an app,
and consent for the selected servers. Your administrator may also need to allow the servers
in Microsoft 365 admin center. Personal Outlook accounts alone do not satisfy these requirements.
See [Microsoft's Work IQ setup and prerequisites](https://learn.microsoft.com/en-sg/microsoft-agent-365/tooling-servers-overview#set-up-work-iq-mcp-servers-for-coding-agents).

## 1. Register the client app

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/), and select the directory
   that contains the Microsoft 365 account you will use.
2. Open **Entra ID → App registrations → New registration**.
3. Name the app, for example **Kucedr Microsoft MCP**.
4. Choose the supported organizational account types required by Microsoft's public-client
   setup. The current servers discover the `organizations` authorization endpoint; use
   **Accounts in any organizational directory** for this flow, rather than personal accounts.
5. Select **Register**. On **Overview**, copy **Application (client) ID** and
   **Directory (tenant) ID**. Use these IDs in the environment configuration below;
   the app's Object ID is a different value.

See [Microsoft's app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
Kucedr uses a desktop public client with an authorization code and PKCE. This setup does not
require a client secret.

## 2. Register the callback

Configure the app as a **Mobile and desktop application**. Kucedr's default callback is:

```text
http://127.0.0.1:3001/oauth/callback
```

Open the app registration's **Authentication** page and add that exact redirect URI to the
mobile/desktop platform. If the portal rejects an HTTP URI containing `127.0.0.1`, open
**Manifest** and add it to the public-client redirect URIs. Preserve any existing values.
In the Microsoft Graph manifest format, the relevant section is:

```json
{
	"publicClient": {
		"redirectUris": ["http://127.0.0.1:3001/oauth/callback"]
	}
}
```

This is a section of the manifest, not a replacement for the entire app manifest. Older manifest
formats use `replyUrlsWithType` with type `InstalledClient`. Microsoft documents the portal
restriction in [loopback redirect URI guidance](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url#prefer-127001-over-localhost);
see also the [public-client redirect URI schema](https://learn.microsoft.com/en-us/graph/api/resources/publicclientapplication?view=graph-rest-1.0).

Alternatively, add `http://localhost:3001/oauth/callback` under **Authentication → Add a
platform → Mobile and desktop applications** and set `CLIENT_REDIRECT_URL` to that exact value
in `.env`. This setting affects every HTTP MCP connection, including Google; update those app
registrations too if they require an exact callback. Use a fixed port for this setup.

## 3. Add server permissions and consent

1. Open **API permissions → Add a permission → APIs my organization uses**.
2. Find the Work IQ API resource for each server you want to connect. Microsoft's example uses
   **WorkIQ-MailServer** for Mail. Select **Delegated permissions**, then the permission exposed
   by that server resource. Current per-server resources use `Tools.ListInvoke.All`.
3. Add only the server resources you intend to use. Ask your administrator to grant consent
   when tenant policy or the selected permission requires it.
4. Confirm that the requested permissions have been consented to before testing Kucedr.

During Microsoft's resource migration, a tenant may expose the older shared **Agent 365 Tools**
API (`ea9ffc3e-8a23-4a7d-836d-234d7c7565c1`) instead. Its delegated permissions are:

| Kucedr connection    | Legacy shared-resource permission   |
| -------------------- | ----------------------------------- |
| Outlook Mail         | `McpServers.Mail.All`               |
| Outlook Calendar     | `McpServers.Calendar.All`           |
| Microsoft Teams      | `McpServers.Teams.All`              |
| OneDrive             | `McpServers.OneDriveSharepoint.All` |
| SharePoint           | `McpServers.OneDriveSharepoint.All` |
| Microsoft Word       | `McpServers.Word.All`               |
| Microsoft 365 Search | `McpServers.CopilotMCP.All`         |

These are app registration permissions, not values to paste into Kucedr's provider manifest.
Kucedr discovers the server's authorization resource and scopes automatically, including token
refresh access. See Microsoft's [legacy permissions reference](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/mcp-authentication#bring-your-own-microsoft-entra-app-registration)
and [resource provisioning script](https://github.com/microsoft/Agent365-devTools/blob/main/scripts/cli/Auth/New-Agent365ToolsServicePrincipalProdPublic.ps1)
for the per-server and shared-resource models.

If a resource is missing from the permission picker, ask your administrator to check its
service principal provisioning using Microsoft's instructions. An ordinary Microsoft Graph
`Mail.Read` permission does not replace the Work IQ server permission.

## 4. Configure Kucedr

Fill the existing entries in the repository root `.env`, using the values from the app's
Overview page:

```dotenv
MICROSOFT_TENANT_ID=your-directory-tenant-id
MICROSOFT_CLIENT_ID=your-application-client-id
CLIENT_REDIRECT_URL=http://127.0.0.1:3001/oauth/callback
```

Replace the placeholder text with your actual IDs. Keep the variables empty until you have
an app registration; empty values are not a working connection. Keep the callback aligned
with step 2, and fully quit and restart Kucedr after editing `.env`.

Development runs load the repository `.env` at startup. Packaged applications do not read this
file: provide these values in the process environment that launches the installed app.
Existing nonempty process environment values take precedence over `.env`.

Kucedr uses `MICROSOFT_TENANT_ID` to resolve the bundled `{tenantId}` endpoints and
`MICROSOFT_CLIENT_ID` for the registered OAuth client. It stores the resulting connection tokens
through its MCP credential store. No `MICROSOFT_CLIENT_SECRET` variable is needed.

## 5. Connect and verify

1. Open **Settings → Integrations** (`/settings/plugins`) and enable the Microsoft service you
   configured. Then open its connection in **Settings → MCP** (`/settings/mcp`).
2. Save the connection if necessary and select **Connect with OAuth**.
3. Sign in with the licensed work or school account in the configured tenant and complete consent.
4. Confirm **Authenticated**, then run the server's **Test** action. A successful result should
   include the tools returned by that server.
5. Try a read-only chat request, such as asking Outlook Calendar for your upcoming events,
   and inspect the tool activity and result.

Repeat authorization and testing for each server. App registration alone does not prove a
connection works; successful OAuth, tool discovery, and a live tool call verify the setup.

## Troubleshooting

| Symptom                                                | What to check                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Missing `MICROSOFT_TENANT_ID` or `MICROSOFT_CLIENT_ID` | Fill `.env` and restart; packaged apps need process environment values.                                       |
| Invalid tenant ID                                      | Use the nonzero Directory (tenant) UUID, rather than `common`, a domain name, or the Object ID.               |
| `AADSTS50011` redirect mismatch                        | Compare the exact callback host, path, and port with the app registration and `CLIENT_REDIRECT_URL`.          |
| Permission or administrator-consent error              | Check the selected server API's delegated permissions and ask the tenant administrator to grant consent.      |
| Server API missing from the permission picker          | Have the administrator check Work IQ resource/service principal provisioning.                                 |
| OAuth succeeds but tool discovery or calls fail        | Check the account's Copilot license, server availability, tenant policies, and access to the underlying data. |
| Callback port is occupied                              | Stop the process using port 3001, or register another fixed callback and update `CLIENT_REDIRECT_URL`.        |

For the shared callback behavior, see [MCP OAuth callback setup](DEVELOPMENT.md#mcp-oauth-callback-setup).
