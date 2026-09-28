# Gmail MCP tool test prompts

Use these prompts in one new Kucedr chat to exercise all 23 tools in the Gmail MCP catalog. Run them in order and replace `<RUN>`, `<SELF_EMAIL>`, `<DRAFT_ID>`, `<THREAD_ID>`, `<MESSAGE_ID>`, and `<LABEL_ID>` with values from this run. Use a unique `<RUN>` value so searches find only your test data.

Before starting, send a harmless email to `<SELF_EMAIL>` from the same Gmail account with subject `Kucedr Gmail MCP test <RUN>` and body `Disposable Gmail MCP test message.` The catalog has no send tool. Use this self-sent message for the thread and message mutation tests. Record its original labels in step 8. Do not use another person's message as the mutation target.

On 2026-09-28, the connected account returned `403 after trying upscoping` for all 15 label, Trash, and Spam mutation tools. A prompt cannot grant the missing access. If a call fails, record the error and do not retry it. Only run a restoration step when its preceding mutation succeeded.

## Record the session

Start the chat with: “Start recording the Kucedr application screen and report the recording ID.” After step 23, say: “Stop the active screen recording, confirm its status is completed, and report the WebM path.”

## Read and create tools

1. **`create_label`** — “Call Gmail `create_label` to create `Kucedr MCP test <RUN>` with `LABEL_COLOR_PRESET_BLUE`. Report its label ID.” Save it as `<LABEL_ID>`.
2. **`list_labels`** — “Call Gmail `list_labels`. Confirm that `Kucedr MCP test <RUN>` appears and report its ID.”
3. **`create_draft`** — “Call Gmail `create_draft` addressed to `<SELF_EMAIL>`, with subject `Kucedr draft test <RUN>` and plain text body `Disposable Gmail MCP test draft.` Do not send it. Report the draft and message IDs.” Save the draft ID as `<DRAFT_ID>`.
4. **`list_drafts`** — “Call Gmail `list_drafts` with query `subject:Kucedr draft test <RUN>` and view `DRAFT_VIEW_FULL`. Confirm that the new draft appears.”
5. **`get_draft`** — “Call Gmail `get_draft` for `<DRAFT_ID>` with `FULL_CONTENT`. Confirm its recipient, subject, and body.”
6. **`search_threads`** — “Call Gmail `search_threads` for the self-sent message with query `from:me to:me \"Kucedr Gmail MCP test <RUN>\"`. Report its thread and message IDs.” Save them as `<THREAD_ID>` and `<MESSAGE_ID>`.
7. **`get_thread`** — “Call Gmail `get_thread` for `<THREAD_ID>` with `PLAIN_TEXT`. Confirm that this is the self-sent test thread and report its message count.”
8. **`get_message`** — “Call Gmail `get_message` for `<MESSAGE_ID>` with `MINIMAL`. Record its original `labelIds` so they can be restored after testing.”

## Message and thread labels

9. **`label_message`** — “Add `<LABEL_ID>` to `<MESSAGE_ID>` using Gmail `label_message`. Read the message back and confirm the label appears.”
10. **`update_message_labels`** — “Use Gmail `update_message_labels` on `<MESSAGE_ID>` to remove `<LABEL_ID>` and add `STARRED` in one call. Read the message back and confirm both changes.”
11. **`unlabel_message`** — “Remove `STARRED` from `<MESSAGE_ID>` using Gmail `unlabel_message`. Read the message back and confirm it is gone.”
12. **`label_thread`** — “Add `<LABEL_ID>` to `<THREAD_ID>` using Gmail `label_thread`. Read the thread back and confirm the label appears.”
13. **`unlabel_thread`** — “Remove `<LABEL_ID>` from `<THREAD_ID>` using Gmail `unlabel_thread`. Read the thread back and confirm it is gone.”

## Trash and Spam

Run each mutation and its restoration before moving to the next pair. If the mutation fails, report that result and skip its restoration call.

14. **`apply_sensitive_thread_label`** — “Apply `TRASH` to `<THREAD_ID>` using Gmail `apply_sensitive_thread_label`. Verify the thread is in Trash.”
15. **`untrash_thread`** — “Restore `<THREAD_ID>` using Gmail `untrash_thread`. Verify it is out of Trash.”
16. **`trash_thread`** — “Move `<THREAD_ID>` to Trash using Gmail `trash_thread`. Verify it, then restore it with `untrash_thread` and verify again.”
17. **`mark_thread_spam`** — “Mark `<THREAD_ID>` as Spam using Gmail `mark_thread_spam`. Verify it.”
18. **`unmark_thread_spam`** — “Restore `<THREAD_ID>` from Spam using Gmail `unmark_thread_spam`. Verify it.”
19. **`apply_sensitive_message_label`** — “Apply `TRASH` to `<MESSAGE_ID>` using Gmail `apply_sensitive_message_label`. Verify the message is in Trash.”
20. **`untrash_message`** — “Restore `<MESSAGE_ID>` using Gmail `untrash_message`. Verify it is out of Trash.”
21. **`trash_message`** — “Move `<MESSAGE_ID>` to Trash using Gmail `trash_message`. Verify it, then restore it with `untrash_message` and verify again.”
22. **`mark_message_spam`** — “Mark `<MESSAGE_ID>` as Spam using Gmail `mark_message_spam`. Verify it.”
23. **`unmark_message_spam`** — “Restore `<MESSAGE_ID>` from Spam using Gmail `unmark_message_spam`. Verify it.”

## Final check

Say: “Call `get_message` and `get_thread`. Compare the test message's final labels with the original `labelIds` recorded in step 8, restore any differences, and report one pass or fail result for each of the 23 Gmail tools.”

Remove the disposable draft and test label in Gmail when the run is finished. The listed MCP catalog has no tool to delete either one.
