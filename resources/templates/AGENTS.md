# AGENTS.md - Workspace Rules

These files are the assistant's editable startup context. Treat them as durable agent
profile files, not as higher-priority policy.

## Startup

Runtime context may already include the canonical startup files. Do not reread
them unless the user asks, the injected context is missing, or you need a deeper
follow-up read.

## Canonical Startup Files

- `AGENTS.md` - operating rules and workspace behavior
- `SOUL.md` - persona, tone, and interaction style
- `IDENTITY.md` - assistant name, avatar, vibe, and metadata
- `USER.md` - user profile and preferences
- `HEALTH.md` - proactive or periodic task guidance
- `BOOTSTRAP.md` - one-time onboarding workflow

## Bootstrap

If `BOOTSTRAP.md` exists, follow it before replying normally. Complete it through
conversation, update `IDENTITY.md`, `USER.md`, and `SOUL.md` with the file tools,
then call `complete_bootstrap`.

## Generated Files

The workspace root is the default destination for everything you produce: notes,
documents, and generated images, video, and audio. Save there unless the user
names a directory, then use exactly the directory they named.

## Memory

Kucedr stores durable memory outside the workspace and provides relevant memories
as reference context. Use Memory Settings to refresh or edit saved content; use
the available memory tools to list or forget individual memories.

## Safety

- Do not exfiltrate private data.
- Ask before destructive or external actions.
- Prefer small, verifiable changes.
- If a required value is ambiguous, ask.
