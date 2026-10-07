# Google MCP use cases

The Google provider manifest lists seven remote MCP services: Gmail, Calendar, Drive, Docs, Sheets, Maps, and Contacts. Gmail SMTP is a separate local server. Each service needs its own connection and a successful MCP **Test** before its tools are available in chat. The catalog entry alone does not prove that your Google account has authorized it.

## Connect a remote Google service

1. Configure the Google OAuth environment and callback described in [Development](../DEVELOPMENT.md#mcp-oauth-callback-setup).
2. In **Settings → Integrations**, add the desired Google service. Open **Settings → MCP servers**, select that service, and choose **Connect with OAuth**.
3. Grant only the account access you intend to test. Run **Test** on the MCP detail page and record its tool names and descriptions.
4. Start a fresh chat, name the service in the prompt, and expand the resulting `mcp__...` activity to verify execution.

For Docs, Sheets, Maps, and Contacts, tool names and schemas come from the live server catalog. If **Test** does not list a matching tool, mark that scenario **blocked by catalog** and record the available names; do not assume a tool exists from the service description.

## Gmail: find and draft mail

1. Send a harmless message to your own account with subject `Kucedr Gmail <RUN>`.
2. Prompt: “Using Gmail, find my message with subject `Kucedr Gmail <RUN>`, report its subject and thread ID, then create an unsent draft to my own address titled `Kucedr draft <RUN>`. Do not send it.”

**Pass:** Gmail search/read and draft tool calls appear; the original message and unsent draft exist in Gmail. Delete the test draft manually. For all 23 tools and known scope-related mutation failures, use the [Gmail tool script](../GMAIL.md).

## Calendar: create and verify an event

Prompt: “Using Google Calendar, find a free 30-minute slot tomorrow in my primary calendar, create a private event named `Kucedr Calendar <RUN>` in that slot with no other attendees and notifications off, then read the event back and report its ID.”

**Pass:** Calendar availability/create/read tools execute and the event appears at the reported time. Delete only the disposable event after verification. The [Calendar tool script](../CALENDAR.md) covers all nine tools, including the guest-only RSVP case.

## Drive: create and read a private file

Prompt: “Using Google Drive, create a private test file named `Kucedr Drive <RUN>` containing `KUCEDR-DRIVE-<RUN>`. Search for it, read it back, and report its ID and MIME type. Do not share it.”

**Pass:** Drive create/search/read activity returns the same marker and file ID. Move the exact test file to Trash through Drive afterward; the checked-in MCP catalog has no delete tool. See the [Drive tool script](../DRIVE.md) for all eight tools.

## Docs: read and edit a disposable document

1. Create a Google Doc you own named `Kucedr Docs <RUN>` containing `Original <RUN>`; keep its link or ID.
2. After **Test** lists suitable Docs tools, prompt: “Using Google Docs and the discovered tools, read my document `<DOC_ID>`, append `Updated <RUN>` once, then read it again. Report the exact tool names used.”

**Pass:** The document contains both markers exactly once and the tool calls are visible. Remove the appended marker or delete the disposable document after testing. If the catalog lacks an edit tool, run the read portion and mark editing blocked.

## Sheets: change one test cell

1. Create a disposable Google Sheet with a tab named `Kucedr test` and cell A1 set to `Before <RUN>`.
2. After **Test** lists suitable Sheets tools, prompt: “Using Google Sheets, read A1 of `<SHEET_ID>` on `Kucedr test`, change it to `After <RUN>`, then read A1 again. Report the tool names and both values.”

**Pass:** The read and write calls execute and A1 is `After <RUN>`. Restore `Before <RUN>` or delete the test sheet. If no write tool is discovered, record the available tools and mark the write portion blocked.

## Maps: look up a place and route

After **Test** lists suitable Maps tools, prompt: “Using Google Maps, find `<PUBLIC_LANDMARK>`, report its address, then find a route from `<PUBLIC_START>` to it. State which Maps tools returned the place and route. Do not use my current location.”

**Pass:** Maps tool activity supports both the place and route details. If only one capability is present in the discovered catalog, test that part and record the missing capability. This is a read-only scenario.

## Contacts: find a disposable contact

1. Create a disposable Google contact named `Kucedr Contact <RUN>` with a test email address you own.
2. After **Test** lists suitable Contacts tools, prompt: “Using Google Contacts, find `Kucedr Contact <RUN>` and report its name and test email. If the discovered tools support updates, change its note to `Checked <RUN>`, read it back, and report the tool names. Do not edit other contacts.”

**Pass:** The returned contact matches the disposable entry; if an update tool exists, its note is verified. Remove the note or delete only the disposable contact afterward. Record a missing update tool as a catalog block.

## Gmail SMTP: send to yourself

1. Set up the separate [Gmail SMTP MCP server](../../resources/mcp/gmail-smtp/README.md) with your Gmail address and app password, then **Test** it in MCP settings. It is not the remote Gmail OAuth server.
2. Prompt: “Use Gmail SMTP `send_email` to send one plain-text message from `<SELF_EMAIL>` to `<SELF_EMAIL>` with subject `Kucedr SMTP <RUN>` and body `Disposable SMTP test <RUN>`. Report the tool result; do not send to anyone else.”

**Pass:** `send_email` executes once and the message arrives in your own inbox. The remote Gmail MCP catalog used in the first Gmail scenario has no send tool.
