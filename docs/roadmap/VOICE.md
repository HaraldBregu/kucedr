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
| 19.1 | Mute and status | A mute button, connection status and elapsed time in dictation and realtime voice | Built; found already in place on 2026-11-25 except one gap. Dictation (`components/ui/prompt-input.tsx`) already had a mute button, waveform, elapsed time and a status word; it said "Listening" while still connecting, and now says "Connecting…" and "Finishing…" (`pages/home/Page.tsx`). The Voice window (`components/voice-window.tsx`) already had a mute button, End and elapsed time, with the persona animation showing the state; it has no text status by an earlier decision. The dictation label change is checked by typecheck and tests only, not in the running app | S |
| 19.2 | Transcript where available | What the user said appears in the chat for models that return it themselves | Built; found in place on 2026-11-25. Adapters that receive input transcripts (`live.ts`, `bidi.ts`, `agent.ts` in `src/main/models/adapters/realtime_voice`) emit `user_transcript_update` and `user_transcript_final`; the voice manager saves the user turn and sends `user_turn` with the text, which `useRealtimeVoice` adds to the chat as a user message. Not checked live, which needs a provider key | S |
| 19.3 | Approvals by voice | Actions with side effects ask first, by voice or on screen | The approval cards used in chat | M |
| 19.4 | Hand off to chat | Continue a voice conversation as a text chat, and the reverse | The chat a voice session creates | M |
| 19.5 | Voice controls the browser | Ask by voice to open a site, click, type or read a page, and watch it happen. Added 2026-11-27 | The browser tool the chat agent uses (`use_web_browser`), called by the realtime model itself, which keeps the standing rule; 19.3 first, since browser actions have side effects | M–L |

## Open decisions

- **Memory in voice.** Recalling memory during a voice session would need a tool the realtime model
  calls itself. It is not planned until asked for.
- **19.3** resolves audit #7; recommended on by default.
