# Home UI

Home is Kucedr's primary conversation workspace after setup. It combines session navigation,
text and file prompts, dictation, realtime voice, streamed responses, tool activity, permission
requests, and generated media on `/home`.

See [Start Page Flow](START.md) for the setup and routing rules that make Home available.

## Flow at a glance

```text
Open /home
  -> restore the selected session ID
  -> load its transcript and active-run snapshot
  -> empty conversation: show suggestions and the composer
  -> existing conversation: show messages, tools, approvals, and media
  -> compose
       -> text or files: Send
       -> microphone button: Dictate or Record
       -> empty composer primary action: Start Voice
  -> stream the response and tool activity
       -> permission or input required: respond inline
       -> Stop: cancel the active run
       -> complete or error: settle the response and refresh history
```

## Layout and navigation

Home should use a split layout with a session sidebar and a chat workspace below the application
title bar.

- The title-bar area should provide the sidebar toggle, global route/settings search, and access to
  [Settings](SETTINGS.md).
- On desktop, the sidebar should be collapsible and resizable by pointer or keyboard. Its saved
  width should be restored from local storage.
- On mobile, the same sidebar should open in a left-side sheet.
- The workspace should keep the conversation in a centered, scrollable column and anchor the
  composer to the bottom.
- **Scroll to latest** should appear when the user is away from the newest message.

## Empty conversation

After history finishes loading, a session with no visible messages and no active run should show:

- a time-of-day **Good morning/afternoon/evening, how are you?** greeting;
- **I'm your assistant. What can I do for you?**;
- **Plan my day**, **Rain sound**, **Create an image**, **Video**, **Brainstorm project ideas**, and **Draft a thank-you** suggestions.

Selecting a suggestion should fill and focus the composer without submitting it. The empty state
should disappear when a real user or assistant message exists, while a response is running, or
while a voice panel is open. The internal welcome message must not appear in the transcript.

## Prompt composer

The composer uses **Ask anything** in an empty chat and **Send follow-up** when messages exist. Its input keeps the same fixed geometry during dictation; only the footer controls change. Attachments appear in a tray above it, and the selected model appears in its footer.

### Text and keyboard behavior

- Unmodified Enter should submit except inside lists and code blocks, where it retains its editing
  behavior.
- Shift, Alt, Meta, or Control with Enter should retain editor behavior instead of submitting.
- Dropping operating-system files into the text editor should insert their local paths as text; the
  attachment picker is the file-attachment path.
- `Cmd/Ctrl+/` should return to chat mode and focus the composer.
- `Cmd/Ctrl+N` should create a UUID-backed chat and focus the composer.

### Command modes

- Typing `/plan` at the start should create a styled Plan token, require following prompt text, and
  send the request in the session's Plan interaction mode.
- A completed plan envelope should render as a **Proposed plan** card. The latest completed plan
  should offer **Implement**, which returns to the default interaction mode and sends the approved
  implementation request.
- Typing `/goal` at the start should create a styled Goal token. Send should remain disabled until
  an objective or control action follows it.
- `/task_list`, `/create_task`, and `/delete_task` should expand into agent instructions before
  sending.

Home does not currently mount a general slash-command browser or searchable skill picker.

## Attachments

Attachment availability should be derived from the selected assistant model before the picker is
enabled. Known text files are supported independently of binary media rules; image, PDF, and other
binary support depends on verified model capabilities.

- Allow multiple files using the model-provided accepted types.
- Show every queued file's name, size, removal action, and validation error.
- Validate the total file count, supported MIME type and extension, per-file size, total text and
  binary size, and any per-media-kind limits.
- Keep invalid attachments visible and disable Send until they are removed or become valid.
- Revalidate queued attachments when the selected model changes.
- Clear the tray when submission begins and encode the captured files for the agent request.

Submitted attachment metadata is not currently rendered in the user bubble or restored transcript.

## Sending, streaming, and stopping

Text, valid attachments, or both should enable **Send message**. Plan and Goal validation and any
attachment error should block submission.

When submission begins, Home should clear the normal input and attachment tray, add the user turn
and a thinking assistant turn, and apply streamed response events to that assistant turn. The
initial `home` session alias should migrate to the persistent session ID returned when the run
starts.

While a response is active, the primary action should become **Stop generation**. Stop should
cancel the exact active run, ignore late output, clear pending approvals or questions, and settle
unfinished tool activity as cancelled or failed. Agent failures should leave the assistant turn in
an Error state.

With an empty composer and no active run, the primary action should become **Start voice
conversation**.

## Messages and generated media

### User messages

- Render non-empty user content in a right-aligned Markdown bubble.
- Provide Copy and inline Edit actions.
- Disable editing while a response is running or voice UI is active.
- Save an edit to the stored user turn without automatically rerunning later turns.
- Collapse earlier user messages longer than 600 characters behind working **More/Less** controls.

### Assistant messages

- Stream Markdown, headings, lists, tables, blockquotes, links, inline code, and highlighted code.
- Open external links outside the application.
- Show Copy, Read aloud, and Reply actions when message text exists. Reply should focus the
  composer.
- Render generated images, audio, and video inline. Local media context menus should expose their
  supported open, reveal, copy, or save actions.
- Visually group adjacent assistant turns and show status text for running, cancelled, completed,
  and error states.

Earlier assistant messages longer than 600 characters currently show **More/Less**, but that
control does not yet change the assistant content layout.

## Tool activity and inline decisions

Tool activity should appear before the assistant text. Skill-related activity should be separated
from other tools. A single tool should render directly; adjacent tools of the same type should use
an expandable summary with their combined duration.

Each tool row should expose its running, completed, rejected, or failed state and make its input,
output, error, duration, and tool-call identity inspectable.

When a tool needs approval, the permission card should identify the action, reason, target paths,
and relevant command or path detail. It should always provide **Deny**, provide **Trust location**
only for a persistable approval, and provide **Allow once** only when that decision is supported.
A stale or failed response should show an inline error and re-enable the available actions.

When the agent requests planning input, Home should render every question inline with its options
and an **Other** choice. The user must answer every question and complete any selected Other field
before **Continue planning** can submit. Resolved and interrupted questions should remain as a
readable summary in the transcript.

## Sidebar and sessions

The sidebar should contain **New chat**, chat history, and a [Settings](SETTINGS.md) link.

- Persist the selected session ID in local storage.
- Poll session summaries every 1.5 seconds and refresh after session, message, or run changes.
- Show loading skeletons, empty-history copy, or a load error with **Refresh**.
- While the legacy `home` alias is selected, treat the newest stored session as active.
- Distinguish queued, running, or cancelling sessions with a shimmering title.
- Create and select a UUID immediately when the user starts a new chat.
- Restore the selected session's stored transcript and active-run snapshot.
- Offer Rename, Clear, Compact, Open location, and Delete from a session's context menu.
- Rename inline, save on blur or Enter, and cancel on Escape.
- After deleting the selected session, create a fresh UUID-backed chat.

Delete and clear require confirmation. Delete failures appear inline in the sidebar; rename failures do not currently show inline feedback.

## Voice input and playback

### Dictation

The microphone action should be based on the selected speech-to-text model:

- a streaming model uses live dictation and appends partial and final transcript text;
- a batch-only model records locally and transcribes after confirmation;
- no compatible model disables the action with **Configure speech to text** guidance.

The dictation panel should show a recording indicator, waveform, elapsed time, **Cancel**, and
**Confirm**. Cancel should discard the active dictation session. Confirm should keep or append the
transcript and return to chat. Capture must respect both Kucedr's microphone setting and system
permission.

The underlying dictation hooks support muting, but the current panel does not expose a mute
control.

### Realtime Voice

Starting Voice should verify that a supported realtime model is configured, audio
capture is available, and microphone permission is granted. It should then open the large persona
panel and start capture, playback, and a realtime session for the selected chat.

User transcripts should become user messages. Assistant transcripts, audio, tool calls, permission
requests, and generated media should use the same conversation components as text chat. New user
speech should stop current assistant playback so the user can interrupt. Ending the panel,
switching sessions, or leaving Home should stop the session and release audio resources.

The current visible conversation panel shows the persona and a top-right **End voice
conversation** control. Realtime status, elapsed time, and mute state are tracked but are not shown
as separate controls in this panel.

### Read aloud

**Read message aloud** should convert assistant Markdown to plain text, synthesize it with the
selected text-to-speech service, and play it. While playback is being prepared or played, the
action should be disabled; synthesis errors should be reflected on the action.

## Loading and error states

- Hide the empty-conversation state while the selected session snapshot is loading.
- Show four sidebar skeleton rows while history is loading and a retry action when the session list
  fails.
- Keep attachment validation errors in the tray and block Send.
- Show tool, permission, and planning-input errors in their related inline components.
- Show voice errors above the composer. Configuration failures should link to Voice settings, and
  microphone failures should link to Microphone settings.
- Let the route error boundary handle a Home rendering failure.

Selected-session snapshot failures currently fall back silently without a transcript-level error
or retry surface.

## Implementation reference

- [Home page](../../src/renderer/src/pages/home/Page.tsx)
- [Session sidebar](../../src/renderer/src/pages/home/Sidebar.tsx)
- [Prompt editor](../../src/renderer/src/components/text-editor.tsx)
- [Agent interaction hook](../../src/renderer/src/pages/home/hooks/useHomeAgent.ts)
- [Attachment handling](../../src/renderer/src/pages/home/attachments/)
- [Assistant messages](../../src/renderer/src/pages/home/components/AssistantMessage.tsx)
- [User messages](../../src/renderer/src/pages/home/components/UserMessage.tsx)
- [Tool permission cards](../../src/renderer/src/pages/home/components/ToolPermissionCard.tsx)
- [Planning input cards](../../src/renderer/src/pages/home/components/UserInputCard.tsx)
- [Realtime voice](../../src/renderer/src/pages/home/hooks/useRealtimeVoice.ts)
- [Home sidebar tests](../../tests/unit/renderer/home-sidebar.test.tsx)
- [Attachment tests](../../tests/unit/renderer/home-attachments.test.tsx)
- [Cancellation tests](../../tests/unit/renderer/home-agent-cancel.test.tsx)
- [Realtime voice tests](../../tests/unit/renderer/realtime-voice.test.tsx)
