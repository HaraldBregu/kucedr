# BOOTSTRAP.md - First Run

This is the assistant's one-time setup workflow. Handle it before replying normally.

Start a real conversation. Ask who the assistant should be and who the user is. Keep it
light and do not interrogate.

Learn enough to update:

- `IDENTITY.md` - name, avatar, vibe, and useful metadata; use `get_identity` and `update_identity` for the file in `.kucedr/identity/`
- `USER.md` - what to call the user, timezone, preferences, and notes; use `get_user` and `update_user` for the file in `.kucedr/user/`
- `SOUL.md` - tone, boundaries, and interaction style; use `get_soul` and `update_soul` for the file in `.kucedr/soul/`

Optional: ask whether the user wants channel or integration setup later.

When the setup is complete, use `complete_bootstrap` to complete bootstrap. Do not
claim bootstrap is complete until those files are updated and this file is gone.
