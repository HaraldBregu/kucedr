# Device use cases

Open the System pages in Settings. Test with your own camera, microphone, and a window containing only disposable content. Operating-system permission may require reopening the app; see [media permissions](../FEATURES.md#media-permissions-and-tests).

## Record and play microphone audio

1. Open **Settings → System → Microphone**, grant permission if asked, and start its test recording.
2. Say `Kucedr microphone <RUN>`, stop, and play the clip.

**Pass:** The recording plays back with the spoken marker. This device test is separate from provider-backed speech transcription.

## Preview and record the camera

1. Open **Settings → System → Camera**, grant permission if asked, and inspect the preview.
2. Record a brief clip, stop, and play it.

**Pass:** The preview shows the selected camera and the recorded clip plays. Stop capture before leaving the page.

## Capture a test window

1. Open **Settings → System → Screen capture** and select a window with non-sensitive test content.
2. Start a short recording, stop it, and play the result.

**Pass:** Playback shows the selected window. If macOS Screen Recording permission was newly granted, fully quit and relaunch the same installed app before retrying.

## Record the app through chat

1. In a new chat, say: “Start a screen recording of the Kucedr application and report the recording ID.”
2. After a harmless on-screen action, say: “Stop recording `<RECORDING_ID>`, wait for its status, and report the WebM path.”

**Pass:** `screen_recorder`, `screen_recorder_stop`, and `screen_recorder_status` appear in tool activity; final status is completed and the reported WebM file plays. A source picker or permission decision may appear before recording starts.
