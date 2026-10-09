# Personal data and file use cases

These tests cover separate stores. Workspace contains agent files; Library contains imported files; Memory contains extracted facts; Knowledge indexes chosen folders. See the [application guide](../APPLICATION.md#personalization-and-memory).

## Retrieve from Knowledge

1. Place a disposable text file containing `KUCEDR-KNOWLEDGE-<RUN>` and a unique fact in a chosen folder.
2. Configure the database, embedding model, disclosures, and index in **Settings → Knowledge**; index the folder and confirm the test passage appears in its retrieval test.
3. Send: “Use my indexed knowledge to find `KUCEDR-KNOWLEDGE-<RUN>`. Give the fact and source path.”

**Pass:** `query_knowledge` returns an indexed excerpt and path supporting the answer. Remove the test source and reindex when finished. Indexing can send source text to the configured embedding and remote database providers.

## Remember and forget a preference

1. Enable Memory and select its model and type in **Settings → Memory**.
2. In chat say: “Remember that for this test I prefer the phrase `violet compass <RUN>`.” After the saved conversation is processed, start another chat and ask for the test preference.
3. Ask the assistant to forget that preference, wait for memory processing, and ask again in a new chat.

**Pass:** The preference is recalled after processing and is absent after the forget request is processed. Memory changes are asynchronous; inspect the stored memory if the timing is unclear.

## Edit a Workspace Markdown file

1. Open **Settings → Workspace** and create `workspace-<RUN>.md`.
2. Type `Kucedr Workspace test <RUN>` in the Markdown editor, switch away, then reopen the file.

**Pass:** The saved text reappears. Rename and delete this disposable file through the Workspace context menu. Non-Markdown text files are read-only in the viewer.

## Import and preview a Library file

1. In **Settings → Library**, create a disposable folder and upload a small image, audio, video, or PDF that you own.
2. Open its preview, switch between List and Collections if useful, and download the file.

**Pass:** Preview and download show the imported file. Delete only the test import and folder afterward; generated media saved to the default location also appears in Library.

## Back up and restore a test folder

1. Connect a supported storage provider, select it in **Settings → Storage**, and choose a disposable local folder containing `backup-<RUN>.txt`.
2. Run a manual backup and check the operation result. Change the local test file, then use confirmed restore for that test folder.

**Pass:** Backup reports transferred data and restore returns the backed-up content. Preserve the changed local copy before restoring if needed; restore can overwrite matching files.
