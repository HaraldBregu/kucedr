# 19. Voice

Part of the [Roadmap](README.md). Status: 19.1 and 19.2 built (checked 2026-11-25); 19.3 and 19.4
proposal.

## What exists today

- Realtime voice (`src/main/models/adapters/realtime_voice`), dictation, read-aloud and a separate
  voice window (`src/main/voice_window.ts`).
- Dictation and the Voice window show mute and elapsed time (19.1); the statement in this list on
  2026-11-19 that they were not shown came from out-of-date docs.
- Some realtime models return no transcript of what the user said; those that do show it (19.2).
- Voice runs side-effect tools without asking ([Security audit](../SECURITY_AUDIT.md) #7, left as a
  decision).

## Standing rule

Voice uses realtime models only: no transcription model inside a voice session, no voice tools that
call another model (image, video, sound, knowledge search), and no other model slots in the voice
profile (`src/shared/agent_tools.ts`). Every feature below keeps that rule.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 19.1 | Mute and status | A mute button, connection status and elapsed time in dictation and realtime voice | State already tracked | S |
| 19.2 | Transcript where available | What the user said appears in the chat for models that return it themselves | Models that provide input transcripts | S |
| 19.3 | Approvals by voice | Actions with side effects ask first, by voice or on screen | The approval cards used in chat | M |
| 19.4 | Hand off to chat | Continue a voice conversation as a text chat, and the reverse | The chat a voice session creates | M |

## Open decisions

- **Memory in voice.** Recalling memory during a voice session would need a tool the realtime model
  calls itself. It is not planned until asked for.
- **19.3** resolves audit #7; recommended on by default.
