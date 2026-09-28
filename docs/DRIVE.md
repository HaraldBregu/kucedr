# Google Drive MCP tool test prompts

Use a new Kucedr chat with DeepSeek V4 Pro. Start a screen recording of the application, then run these prompts in order. Replace `<RUN>`, `<FILE_ID>`, and `<COPY_ID>` with values from this run. Choose a unique `<RUN>` value, and keep both test files private.

## Record the session

Say: “Start `screen_recorder` with target `application` and report the recording ID and path.” Before ending the chat, call `screen_recorder_stop` for that ID, then `screen_recorder_status` with `wait` true. Confirm `completed`, a nonzero file size, and the saved WebM path. An initial `selecting` status can precede a completed recording; verify the final status.

## Create and discover

1. **`search_files`** — “Call Google Drive `search_files` with query `title = 'Kucedr Drive MCP test <RUN>'`. Report any existing matches.” Choose a run value with no matches.
2. **`create_file`** — “Call Google Drive `create_file` with title `Kucedr Drive MCP test <RUN>`, `textContent` `Disposable Drive MCP test content. Token: KUCEDR-DRIVE-<RUN>.`, and `contentMimeType` `text/plain`. Use the default conversion to Google Docs. Do not share it. Report its exact ID and MIME type.” Save the ID as `<FILE_ID>`.
3. **`list_recent_files`** — “Call Google Drive `list_recent_files` with pageSize 10 and excludeContentSnippets true. Confirm `<FILE_ID>` appears.”
4. **`search_files`** — “Search again for `title = 'Kucedr Drive MCP test <RUN>'`. Confirm the exact `<FILE_ID>`.” This discovery call also establishes the ID for `read_file_content`.

## Inspect the file

5. **`get_file_metadata`** — “Call Google Drive `get_file_metadata` for `<FILE_ID>` with excludeContentSnippets true. Report title, MIME type, owner, and parent.”
6. **`get_file_permissions`** — “Call Google Drive `get_file_permissions` for `<FILE_ID>`. Report the roles and confirm no new sharing was added.”
7. **`read_file_content`** — “Call Google Drive `read_file_content` for the exact `<FILE_ID>` returned by `search_files`. Confirm the text contains `KUCEDR-DRIVE-<RUN>`.”
8. **`download_file_content`** — “Call Google Drive `download_file_content` for `<FILE_ID>` with exportMimeType `text/plain`. Confirm the decoded content contains `KUCEDR-DRIVE-<RUN>`; do not print the full base64.”

## Copy and clean up

9. **`copy_file`** — “Call Google Drive `copy_file` for `<FILE_ID>` with title `Kucedr Drive MCP test <RUN> copy`. Report its exact ID as `<COPY_ID>`. Use `get_file_metadata` to confirm the copy title and MIME type. Search for the copy before calling `read_file_content` on it, then confirm the same token appears.”

The catalog has no Trash or delete tool. After the recording is finalized, find the two exact test titles in Google Drive and move only those files to Trash through the Drive UI. Verify they disappear from the normal search results. Do not empty Trash.

The 2026-09-28 live run invoked all eight distinct Drive tools successfully. Its first recording was interrupted before finalization, so a completed recording and file check are required for evidence.
