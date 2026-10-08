# Google OAuth scope use cases

These examples describe what an application could do after a user grants each Google OAuth scope. A scope grants permission; the connected API or MCP server must also expose the needed operation. Kucedr's current Google provider manifest requests `gmail.modify`, `calendar`, and `drive` for its Gmail, Calendar, and Drive MCP services, so the narrower scopes below are separate authorization examples rather than claims about the current MCP tool catalog. For a Kucedr chat test, connect the relevant service, run **Test** to discover its tools, then follow the [Google MCP use cases](google.md).

For every example, use an account and disposable data you control. Grant the named scope, perform the described action through an API method that accepts it, and confirm the result in Google before cleaning up. Google's [Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [Calendar](https://developers.google.com/workspace/calendar/api/auth), and [Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) scope guides are the authority for the permissions below.

## Gmail

### `https://www.googleapis.com/auth/gmail.modify`

**Use case:** Triage a test message: read it, add a label, mark it read, and move it to Trash. Verify the content and each label change. This scope also permits composing and sending mail, but does not permit immediately and permanently deleting messages or threads while bypassing Trash.

### `https://www.googleapis.com/auth/gmail.compose`

**Use case:** Create an unsent reply draft to a test address, edit its body, and send it only after review. Verify the draft changes and the sent message. This scope manages drafts and sending without granting general inbox reading.

### `https://www.googleapis.com/auth/gmail.settings.basic`

**Use case:** Create a filter for mail with a unique test subject that applies a test label. Verify the filter and remove it afterward. This scope covers basic mail settings and filters; sensitive sharing settings need a different scope.

### `https://www.googleapis.com/auth/gmail.readonly`

**Use case:** Find a test email and display its sender, subject, and body in a read-only mail summary. Verify they match Gmail. Do not modify the message.

### `https://www.googleapis.com/auth/gmail.send`

**Use case:** Send one preapproved message to an address you own and verify its arrival. This scope allows sending; it does not provide mailbox reading or draft management.

### `https://www.googleapis.com/auth/gmail.metadata`

**Use case:** List recent message IDs and inspect their headers and labels to build an inbox index without reading bodies. Verify the index contains no message body. The Gmail `messages.list` `q` search parameter is unavailable with this scope.

### `https://www.googleapis.com/auth/gmail.drafts.readonly` — unsupported

**Intended use case:** Show a list and preview of unsent drafts without changing them. Google does not list this as a Gmail API OAuth scope. Use `gmail.readonly` for read-only draft access; the [draft list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/list) and [draft get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/get) methods list their accepted scopes.

### `https://www.googleapis.com/auth/gmail.drafts.create` — unsupported

**Intended use case:** Save a proposed message as an unsent draft. Google does not list this as a Gmail API OAuth scope. Use `gmail.compose` or `gmail.modify`; both are accepted by [draft create](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create).

### `https://www.googleapis.com/auth/gmail.drafts` — unsupported

**Intended use case:** Create, review, update, and send drafts. Google does not list this as a Gmail API OAuth scope. Use `gmail.compose` for draft management and sending; see the [Gmail draft methods](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts).

## Calendar

### `https://www.googleapis.com/auth/calendar`

**Use case:** Create a disposable secondary calendar, add and edit a test event, share the calendar with a test account, then remove the test resources. Verify the event and sharing changes. This is the broad calendar permission.

### `https://www.googleapis.com/auth/calendar.readonly`

**Use case:** Build a read-only agenda from calendars the user can access and export the schedule. Verify the displayed events match Google Calendar without changing them.

### `https://www.googleapis.com/auth/calendar.events`

**Use case:** Book a test event, reschedule it, and cancel it on a calendar where the user can edit events. Verify each state in Google Calendar. This scope concerns events, not calendar sharing rules.

### `https://www.googleapis.com/auth/calendar.events.readonly`

**Use case:** Show the title, time, and location of upcoming events across accessible calendars. Verify the details without changing an event.

### `https://www.googleapis.com/auth/calendar.calendarlist`

**Use case:** Subscribe the user to a disposable calendar in their calendar list, then remove that list entry. Verify the calendar appears and disappears from the user's list; the underlying calendar is not deleted.

### `https://www.googleapis.com/auth/calendar.calendars`

**Use case:** Create a secondary calendar and change its name, description, or time zone. Verify the new properties. This scope manages calendars themselves, rather than their events or sharing rules.

### `https://www.googleapis.com/auth/calendar.acls`

**Use case:** Grant a test account access to a disposable calendar the user owns, verify the permission, then revoke it. This scope manages calendar sharing permissions.

## Drive

### `https://www.googleapis.com/auth/drive`

**Use case:** Create a private test file, read it, rename it, move it to a folder, and move it to Trash. Verify each change. This scope provides broad access to manage Drive files.

### `https://www.googleapis.com/auth/drive.readonly`

**Use case:** Search for a test document, preview or download its contents, and verify the downloaded content matches. Do not change the file.

### `https://www.googleapis.com/auth/drive.metadata.readonly`

**Use case:** Build a file inventory showing names, types, owners, and modification times. Verify the metadata against Drive; do not read file contents or change metadata.

### `https://www.googleapis.com/auth/drive.metadata`

**Use case:** Find a test file and update its name or description while leaving its content intact. Verify the metadata change and unchanged content. This scope manages file metadata, not file contents.

### `https://www.googleapis.com/auth/drive.photos.readonly`

**Use case:** Build a read-only photo and video picker for media exposed by an API method that accepts this scope. Verify the selected media can be viewed without changing it. Google lists this scope in its [global OAuth scope catalog](https://developers.google.com/identity/protocols/oauth2/scopes), but omits it from the current Drive API scope guide; check the target method before relying on it. It does not imply access to every item in a modern Google Photos library.

### `https://www.googleapis.com/auth/drive.meet.readonly`

**Use case:** Find a recording or transcript file created by Google Meet in Drive and show it for a meeting recap. Verify the file belongs to the intended meeting and remains unchanged. This scope is limited to Drive files created or edited by Meet.
