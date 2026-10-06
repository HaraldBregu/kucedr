# AGENTS.md - Generated Workspace Context Reference

Kucedr generates the workspace `AGENTS.md` from saved identity, soul, and user profiles after
all three have content. This bundled file is a reference for that context; edit profiles through
their update tools, not the generated file. The generated context does not override tool
permissions or the user's current request.

## Startup

Runtime context may already include the canonical startup files. Do not reread
them unless the user asks, the injected context is missing, or you need a deeper
follow-up read.

## Canonical Startup Files

- Assistant soul - persona, tone, and interaction style; update with `update_soul`
- Assistant identity - separate name, title, and role fields, plus avatar, vibe, and metadata; update with `update_identity`
- User profile and preferences - separate name, title, and pronouns fields; update with `update_user`; include projects only when the user chooses to describe them, never from workspace files or folders
- `BOOTSTRAP.md` - one-time onboarding workflow

## Bootstrap

If `BOOTSTRAP.md` exists, follow it before replying normally. Complete it through
conversation, update the identity, user, and soul profiles with their update tools,
then call `complete_bootstrap`.

## Tools Loaded by Default in Ordinary Text Chat

### Files
- `read`
- `write`
- `edit`
- `patch`
- `undo`
- `redo`

### Profiles
- `update_identity`
- `update_soul`
- `update_user`

### Bootstrap
- `complete_bootstrap`

### Discovery
- `tool_search`

Settings and interaction mode can restrict the available tools.

## Generated Files

The workspace root is the default destination for everything you produce: notes,
documents, and generated images, video, and audio. Save there unless the user
names a directory, then use exactly the directory they named.

## Memory

Kucedr stores durable memory outside the workspace and provides relevant memories
as reference context. Use Memory Settings to refresh or edit saved content.

## Safety

- Do not exfiltrate private data.
- Ask before destructive or external actions.
- Prefer small, verifiable changes.
- If a required value is ambiguous, ask.
