# Feedback sounds

The thinking and response sounds are from [Kenney Interface Sounds 1.0](https://kenney.nl/assets/interface-sounds).
Downloaded from the [official archive](https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip).
License: CC0; see [License.txt](License.txt). Files are unmodified.

| File | Feedback |
| --- | --- |
| bencho_click.wav | New chat, settings, search, navigation, send and theme change |
| question_003.ogg | Assistant starts thinking |
| confirmation_001.ogg | Assistant finishes a reply |

The click is rendered from [Bencho’s interaction sound](https://bencho.dev/): a 196 to 130 Hz sine sweep over 150 ms with a 900 Hz low-pass filter and an exponential gain envelope peaking at 0.07.

Sounds are imported by the renderer so Vite bundles them for offline playback.
