# Google Calendar MCP tool test prompts

Use a new Kucedr chat with DeepSeek V4 Pro and record the application screen. Run these prompts in order. Replace `<SELF_EMAIL>`, `<RUN>`, and `<EVENT_ID>` with values from the current run. Use a unique `<RUN>` value. Keep notifications off and avoid inviting anyone else.

The live run on 2026-09-28 invoked all nine tools. Eight succeeded. `respond_to_event` rejected the disposable event because its organizer was not listed as an attendee. An RSVP success test requires a disposable invitation where the authenticated user is a guest. Do not change a real invitation for this test.

## Record the session

Start with: “Start recording the Kucedr application screen with `screen_recorder` target `application`. Report its ID and path.” At the end, stop the recording by ID, call `screen_recorder_status` with `wait` true, and confirm `completed` and the WebM path.

## Discover and create

1. **`list_calendars`** — “Call Google Calendar `list_calendars`. Report the primary calendar ID and time zone.” Save its ID as `<SELF_EMAIL>`.
2. **`search_events`** — “Call Google Calendar `search_events` with query `Kucedr Calendar MCP test <RUN>`. Report any existing matches.” Choose a run value with no matches.
3. **`suggest_time`** — “Call Google Calendar `suggest_time` for attendeeEmails [`<SELF_EMAIL>`], a 30-minute duration, and a specific future three-hour window in the primary calendar's time zone. Report the suggested slots.” Use one free slot for the event.
4. **`create_event`** — “Call Google Calendar `create_event` on `<SELF_EMAIL>` with summary `Kucedr Calendar MCP test <RUN>`, a 30-minute start and end within the suggested slot, description `Disposable connector test; delete after verification.`, `notificationLevel` `NONE`, and `useDefaultReminders` false. Do not add other attendees or a Meet link. Report the event ID.” Save it as `<EVENT_ID>`.

## Read and update

5. **`list_events`** — “Call Google Calendar `list_events` on `<SELF_EMAIL>` with `fullText` `Kucedr Calendar MCP test <RUN>` and no time bounds. Confirm `<EVENT_ID>` appears.”
6. **`get_event`** — “Call Google Calendar `get_event` on `<SELF_EMAIL>` for `<EVENT_ID>`. Confirm title, time, description, and status.”
7. **`search_events`** — “Call Google Calendar `search_events` with query `Kucedr Calendar MCP test <RUN>`. Confirm `<EVENT_ID>` appears.”
8. **`update_event`** — “Call Google Calendar `update_event` on `<SELF_EMAIL>` for `<EVENT_ID>`. Change only the description to `Disposable connector test; updated; delete after verification.` with `notificationLevel` `NONE`. Call `get_event` again and confirm the new description.”

## Response test

9. **`respond_to_event`** — If a separate disposable invitation exists where `<SELF_EMAIL>` is a guest, say: “Call Google Calendar `respond_to_event` for that invitation with `responseStatus` `tentative` and `notificationLevel` `NONE`. Verify it, then call again with the original response status to restore it.” If no such invitation exists, call `respond_to_event` once on `<EVENT_ID>` with `tentative` and `NONE`, record the organizer/attendee error, and do not alter a real event.

## Delete and verify

10. **`delete_event`** — “Call Google Calendar `delete_event` on `<SELF_EMAIL>` for `<EVENT_ID>` with `notificationLevel` `NONE`. Then call `search_events` for `Kucedr Calendar MCP test <RUN>` and confirm an empty result. Call `get_event` for `<EVENT_ID>` and report the deleted-resource result.”

Report one result for each of the nine distinct Calendar tools. If a tool call fails with `unknown tool`, retry it through tool discovery and record both attempts.
