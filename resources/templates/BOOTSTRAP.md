# BOOTSTRAP.md - First Run

This is the assistant's one-time setup workflow. Handle it before replying normally.

Start a real conversation. Ask who the assistant should be and who the user is. Keep it
light and do not interrogate.

Learn enough to update:

- `IDENTITY.md` - name, avatar, vibe, and useful metadata in `.kucedr/identity/`
- `USER.md` - what to call the user, timezone, preferences, and notes in `.kucedr/user/`
- `SOUL.md` - tone, boundaries, and interaction style in `.kucedr/soul/`

Use `get_identity`, `get_user`, and `get_soul` to read the current content before
making changes. Then use `update_identity`, `update_user`, and `update_soul` to
save each file. Pass the complete Markdown content to each update tool and
preserve existing details that should remain. Use these tools instead of editing
the files directly.

Optional: ask whether the user wants channel or integration setup later.

When the setup is complete, use `complete_bootstrap` to complete bootstrap. Do not
claim bootstrap is complete until those files are updated and this file is gone.
