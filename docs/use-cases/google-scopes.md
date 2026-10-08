# Google OAuth scope use cases

These examples describe what an application could do after a user grants each Google OAuth scope. A scope grants permission; the connected API or MCP server must also expose the needed operation. Kucedr's current Google provider manifest requests `gmail.modify`, `calendar`, and `drive` for its Gmail, Calendar, and Drive MCP services, so the narrower scopes below are separate authorization examples rather than claims about the current MCP tool catalog. For a Kucedr chat test, connect the relevant service, run **Test** to discover its tools, then follow the [Google MCP use cases](google.md).

Replace angle-bracket values before pasting a prompt into a new Kucedr chat. Use an account and disposable data you control. Each prompt names the intended service and asks for the tool result; if a needed tool is missing, the assistant should say which step is blocked. The current Kucedr connections use broader scopes, so a successful chat call does not prove that the narrower scope alone is sufficient. Testing a specific scope requires a connection authorized with that scope and an API method that accepts it. Google's [Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [Calendar](https://developers.google.com/workspace/calendar/api/auth), and [Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) scope guides are the authority for the permissions below.

## Gmail

### `https://www.googleapis.com/auth/gmail.modify`

**Use case:** Triage a test message: read it, add a label, mark it read, and move it to Trash. Verify the content and each label change. This scope also permits composing and sending mail, but does not permit immediately and permanently deleting messages or threads while bypassing Trash.

**Prompt:** “Using the connected Gmail tools, find my disposable message with subject `Kucedr triage <RUN>`. Read it, create or use a label named `Kucedr test <RUN>`, apply that label, mark the message read, and move it to Trash. Read its labels after each change and report the message ID and tools used. Do not touch other messages or permanently delete anything. If a required tool is missing or fails, stop and report the blocked step.”

### `https://www.googleapis.com/auth/gmail.compose`

**Use case:** Create an unsent reply draft to a test address, edit its body, and send it only after review. Verify the draft changes and the sent message. This scope manages drafts and sending without granting general inbox reading.

**Prompt:** “Using the connected Gmail tools, create a draft to `<SELF_EMAIL>` with subject `Kucedr compose <RUN>` and body `First version <RUN>`. Read it back, replace the body with `Approved version <RUN>`, then send that draft to `<SELF_EMAIL>` and report its ID and final state. Do not read inbox messages or send any other mail. If draft editing or sending is unavailable, leave the draft unsent and report the missing tool.”

### `https://www.googleapis.com/auth/gmail.settings.basic`

**Use case:** Create a filter for mail with a unique test subject that applies a test label. Verify the filter and remove it afterward. This scope covers basic mail settings and filters; sensitive sharing settings need a different scope.

**Prompt:** “Using the connected Gmail tools, create a temporary filter for subject `Kucedr filter <RUN>` that applies label `Kucedr test <RUN>`. Read the filter back, then remove only that test filter and report the filter ID and tools used. If filter management is unavailable, make no settings changes and report the missing tool.”

### `https://www.googleapis.com/auth/gmail.readonly`

**Use case:** Find a test email and display its sender, subject, and body in a read-only mail summary. Verify they match Gmail. Do not modify the message.

**Prompt:** “Using the connected Gmail tools, find the message with subject `Kucedr read <RUN>` and report its sender, subject, body, and message ID. Do not modify, label, trash, or send any mail. Report the exact tools used, or say which read tool is missing.”

### `https://www.googleapis.com/auth/gmail.send`

**Use case:** Send one preapproved message to an address you own and verify its arrival. This scope allows sending; it does not provide mailbox reading or draft management.

**Prompt:** “Using the connected Gmail service, send exactly one plain-text message to `<SELF_EMAIL>` with subject `Kucedr send <RUN>` and body `Disposable send test <RUN>`. Report the send tool result and message ID. Do not use Gmail SMTP or another sender. If the Gmail service has no send tool, send nothing and report that limitation.”

### `https://www.googleapis.com/auth/gmail.metadata`

**Use case:** List recent message IDs and inspect their headers and labels to build an inbox index without reading bodies. Verify the index contains no message body. The Gmail `messages.list` `q` search parameter is unavailable with this scope.

**Prompt:** “Using the connected Gmail tools, list up to five recent message IDs without a search query, then show only each message's sender, subject, date, and label IDs. Do not retrieve or quote message bodies. Report the tools used; if a metadata-only list or read operation is unavailable, report the missing capability.”

### `https://www.googleapis.com/auth/gmail.drafts.readonly` — unsupported

**Intended use case:** Show a list and preview of unsent drafts without changing them. Google does not list this as a Gmail API OAuth scope. Use `gmail.readonly` for read-only draft access; the [draft list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/list) and [draft get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/get) methods list their accepted scopes.

**Prompt using `gmail.readonly`:** “Using the connected Gmail tools, list my unsent drafts and show the recipient and subject of the draft titled `Kucedr draft <RUN>`. Do not edit, send, or delete any draft. Report the draft ID and read tools used, or the missing capability.”

### `https://www.googleapis.com/auth/gmail.drafts.create` — unsupported

**Intended use case:** Save a proposed message as an unsent draft. Google does not list this as a Gmail API OAuth scope. Use `gmail.compose` or `gmail.modify`; both are accepted by [draft create](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create).

**Prompt using `gmail.compose` or `gmail.modify`:** “Using the connected Gmail tools, create one unsent draft to `<SELF_EMAIL>` with subject `Kucedr draft create <RUN>` and body `Disposable draft <RUN>`. Read it back, report its draft ID and recipient, and do not send it. If draft creation is unavailable, report the missing tool.”

### `https://www.googleapis.com/auth/gmail.drafts` — unsupported

**Intended use case:** Create, review, update, and send drafts. Google does not list this as a Gmail API OAuth scope. Use `gmail.compose` for draft management and sending; see the [Gmail draft methods](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts).

**Prompt using `gmail.compose`:** “Using the connected Gmail tools, create a draft to `<SELF_EMAIL>` titled `Kucedr draft workflow <RUN>` with body `Initial <RUN>`, read it, update its body to `Final <RUN>`, and send that draft to `<SELF_EMAIL>`. Report the draft ID and each tool result. If update or send is unavailable, leave the draft unsent and report the blocked step.”

## Calendar

### `https://www.googleapis.com/auth/calendar`

**Use case:** Create a disposable secondary calendar, add and edit a test event, share the calendar with a test account, then remove the test resources. Verify the event and sharing changes. This is the broad calendar permission.

**Prompt:** “Using Google Calendar, create a secondary calendar named `Kucedr calendar <RUN>`, add a private 30-minute event tomorrow named `Kucedr event <RUN>`, change its description to `Verified <RUN>`, and grant `<TEST_EMAIL>` access to that calendar. Read back the event and sharing rule, then remove only these test resources. Keep notifications off. If any calendar or sharing tool is missing, make no changes and report the blocked step.”

### `https://www.googleapis.com/auth/calendar.readonly`

**Use case:** Build a read-only agenda from calendars the user can access and export the schedule. Verify the displayed events match Google Calendar without changing them.

**Prompt:** “Using Google Calendar, list the calendars I can access and show tomorrow's events from my primary calendar in time order, with title, start, end, and calendar ID. Do not create or change anything. Report the read tools used or a missing read capability.”

### `https://www.googleapis.com/auth/calendar.events`

**Use case:** Book a test event, reschedule it, and cancel it on a calendar where the user can edit events. Verify each state in Google Calendar. This scope concerns events, not calendar sharing rules.

**Prompt:** “Using Google Calendar on my primary calendar, create a private 30-minute event tomorrow named `Kucedr event <RUN>` with notifications off and no guests. Read back its ID and time, move it one hour later, verify the new time, then delete only that event and verify it is gone. Report each tool result; stop if a required event tool is missing.”

### `https://www.googleapis.com/auth/calendar.events.readonly`

**Use case:** Show the title, time, and location of upcoming events across accessible calendars. Verify the details without changing an event.

**Prompt:** “Using Google Calendar, list my events for the next seven days and report each event's title, start time, end time, location, and calendar ID. Do not create, edit, or delete events. Report the read tools used or the missing capability.”

### `https://www.googleapis.com/auth/calendar.calendarlist`

**Use case:** Subscribe the user to a disposable calendar in their calendar list, then remove that list entry. Verify the calendar appears and disappears from the user's list; the underlying calendar is not deleted.

**Prompt:** “Using Google Calendar, add the disposable calendar `<TEST_CALENDAR_ID>` to my calendar list, verify it appears, then remove only its calendar-list entry and verify it disappears. Do not delete the underlying calendar. If calendar-list editing is unavailable, make no changes and report the missing tool.”

### `https://www.googleapis.com/auth/calendar.calendars`

**Use case:** Create a secondary calendar and change its name, description, or time zone. Verify the new properties. This scope manages calendars themselves, rather than their events or sharing rules.

**Prompt:** “Using Google Calendar, create a secondary calendar named `Kucedr properties <RUN>`, change its description to `Disposable test <RUN>`, and read back its ID, name, and description. Do not change my primary calendar. If calendar creation or property editing is unavailable, make no changes and report the missing tool.”

### `https://www.googleapis.com/auth/calendar.acls`

**Use case:** Grant a test account access to a disposable calendar the user owns, verify the permission, then revoke it. This scope manages calendar sharing permissions.

**Prompt:** “Using Google Calendar, grant `<TEST_EMAIL>` access to the disposable calendar `<TEST_CALENDAR_ID>`, read back that sharing rule, then revoke only that rule and verify removal. Do not change access on other calendars. If sharing-rule tools are unavailable, make no changes and report the missing tool.”

## Drive

### `https://www.googleapis.com/auth/drive`

**Use case:** Create a private test file, read it, rename it, move it to a folder, and move it to Trash. Verify each change. This scope provides broad access to manage Drive files.

**Prompt:** “Using Google Drive, create a private file named `Kucedr Drive <RUN>` containing `KUCEDR-DRIVE-<RUN>`, read it back, rename it to `Kucedr Drive verified <RUN>`, move it to `<TEST_FOLDER_ID>`, and finally move only that file to Trash. Report its file ID and verify each step. Do not share it. If rename, move, or Trash tools are missing, report the blocked steps and leave the file private.”

### `https://www.googleapis.com/auth/drive.readonly`

**Use case:** Search for a test document, preview or download its contents, and verify the downloaded content matches. Do not change the file.

**Prompt:** “Using Google Drive, find the private test document named `Kucedr read <RUN>`, report its file ID and MIME type, and read or download its contents to confirm the marker `KUCEDR-READ-<RUN>`. Do not edit, copy, share, or delete it. Report the read tools used or the missing capability.”

### `https://www.googleapis.com/auth/drive.metadata.readonly`

**Use case:** Build a file inventory showing names, types, owners, and modification times. Verify the metadata against Drive; do not read file contents or change metadata.

**Prompt:** “Using Google Drive, list up to ten recent files and report only each file's ID, name, MIME type, owner, and modified time. Do not read or download contents and do not change files. Report the metadata tools used or a missing field or tool.”

### `https://www.googleapis.com/auth/drive.metadata`

**Use case:** Find a test file and update its name or description while leaving its content intact. Verify the metadata change and unchanged content. This scope manages file metadata, not file contents.

**Prompt:** “Using Google Drive, find the private file named `Kucedr metadata <RUN>`, change only its description to `Verified <RUN>`, and read back its ID, name, and description. Do not read or change its contents. If metadata editing is unavailable, make no changes and report the missing tool.”

### `https://www.googleapis.com/auth/drive.photos.readonly`

**Use case:** Build a read-only photo and video picker for media exposed by an API method that accepts this scope. Verify the selected media can be viewed without changing it. Google lists this scope in its [global OAuth scope catalog](https://developers.google.com/identity/protocols/oauth2/scopes), but omits it from the current Drive API scope guide; check the target method before relying on it. It does not imply access to every item in a modern Google Photos library.

**Prompt:** “Using the connected Google Drive service, find up to five photo or video files available to it and report each file's name, MIME type, and ID. Do not edit, share, or delete media. Report the tools used and whether they can display a selected file; if this service cannot access photo or video files, report that limitation.”

### `https://www.googleapis.com/auth/drive.meet.readonly`

**Use case:** Find a recording or transcript file created by Google Meet in Drive and show it for a meeting recap. Verify the file belongs to the intended meeting and remains unchanged. This scope is limited to Drive files created or edited by Meet.

**Prompt:** “Using Google Drive, find the recording or transcript from my test meeting on `<MEETING_DATE>` with title `<MEETING_TITLE>`. Report its file ID, name, MIME type, and any available content needed for a short recap. Do not edit, share, or delete it. If the Drive tools cannot identify a Meet-created file or read its content, report that limitation.”
