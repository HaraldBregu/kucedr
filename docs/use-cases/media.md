# Generated media use cases

Select each service in Agent settings and use an executable model from the [provider reference](../PROVIDERS.md#image). Generated files are saved in `~/.kucedr/library` by default and displayed in Home; no separate media studio route is required. Ask for a specific save directory to use another location.

## Generate an image

1. Select a supported image provider and model.
2. Send: “Create one image of a red bicycle beside a blue door at sunset. Report the saved file path.”

**Pass:** `create_image` completes, an image appears inline, and its saved file appears in Library. The image visibly contains the requested main objects.

## Generate a video

1. Select a supported video provider and model. Allow several minutes for generation.
2. Send: “Create a short video of a paper boat floating along a calm stream. Report the saved file path.”

**Pass:** `create_video` completes, the video appears inline, its file appears in Library, and playback works. If testing Pika, check the [provider limitation](../PROVIDERS.md#video) before treating an adapter failure as a general video failure.

## Generate music

1. Select **ElevenLabs → Eleven Music** for Audio. Other cataloged music models currently have no execution adapter.
2. Send: “Create a short instrumental music cue with a gentle piano melody and no vocals. Report the saved file path.”

**Pass:** `create_sound` completes, an audio player appears inline, and the saved file plays. Record the prompt and provider because duration and composition can vary.

## Generate a sound effect

1. Select **ElevenLabs → ElevenLabs Sound Effects** for Audio.
2. Send: “Create a sound effect of a wooden door closing softly in a quiet room, with no speech or music. Report the saved file path.”

**Pass:** `create_sound` completes, an audio player appears inline, and playback resembles the requested effect. Music and effects share the same agent tool but use different selected audio models.
