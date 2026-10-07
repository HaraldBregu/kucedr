# Conversation use cases

These tests use Home. The [Home reference](../ui/HOME.md) describes the controls and current limits.

## Stream and continue a conversation

1. Start a new chat with an Assistant model selected.
2. Send: “Give me three practical ways to organize a small home office. Number them.”
3. After it finishes, send: “Expand the second idea into a five-step checklist.”

**Pass:** Text streams into the first response; the follow-up uses the earlier list, and both turns reappear after switching away and back to the session.

## Rename and restore a session

1. Rename that session from its sidebar context menu to `Kucedr chat test <RUN>`.
2. Create another chat, then return to the renamed one.

**Pass:** The custom title and both conversation turns persist. Clear, compact, and delete are separate confirmation-backed actions; test them only on a disposable session.

## Attach an image or PDF

1. Use the attachment picker to add a non-sensitive image or PDF containing a distinctive detail.
2. Send: “Describe the detail in this attachment and say what you used as evidence.”

**Pass:** The submitted attachment appears with the user message and the answer reflects its content. Reopen the session and confirm the attachment is still shown. An unsupported provider/file combination can fail during processing; the composer does not prevalidate every type.

## Plan before acting

1. In a new chat, send: `/plan Outline a safe way to reorganize my test notes folder. Do not change files yet.`
2. Review any inline questions and the proposed plan.

**Pass:** The run remains in Plan mode and presents a plan without changing the folder. A completed plan can offer **Implement**; use that only with a disposable folder.

## Create and control a goal

1. Send: `/goal Help me prepare a two-day study plan with a checklist.`
2. In that conversation, use `/goal pause`, `/goal resume`, and `/goal clear` in turn.

**Pass:** Each control reports the corresponding goal state for this conversation. A bare `/goal` cannot be submitted from Home.

## Inspect a permission decision

1. In **Settings → Permissions**, leave a disposable directory outside the trusted agent workspace unmatched by allow and deny rules.
2. Ask: “Create a small text file in `<TEST_DIRECTORY>` containing `Kucedr permission test <RUN>`.”

**Pass:** An interactive permission card identifies the requested target; **Deny** prevents the write, while **Allow once** permits only that request if offered. Check the file system and tool activity for the selected outcome. Remove any file created during the test.
