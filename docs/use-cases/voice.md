# Voice use cases

Configure the relevant model in Agent settings and check microphone permission under System. Transcription, realtime conversation, and read aloud use independent selections. See [voice behavior](../ui/HOME.md#voice-input-and-playback).

## Dictate into the composer

1. Select a supported Transcription model and start dictation from the composer.
2. Say: “Kucedr voice test, blue river, seven stones.” Confirm the recording or live transcript.

**Pass:** The recognized words appear in the composer, ready for editing before Send. Cancel a second recording and confirm that its speech is discarded.

## Hold a realtime voice conversation

1. Select a supported OpenAI or xAI realtime model and start Voice with an empty composer.
2. Say: “What are two ways to remember a short shopping list?” Follow with “Repeat the second way.”
3. End the voice conversation.

**Pass:** User and assistant transcripts appear in the same chat, audio plays, the follow-up uses the prior answer, and capture stops when the panel ends.

## Read an answer aloud

1. Select a supported text-to-speech model and ask for a one-sentence answer in chat.
2. Use **Read message aloud** on the assistant response.

**Pass:** Playback starts and reads the answer. If synthesis fails, the action shows an error; record the selected voice model and message length.
