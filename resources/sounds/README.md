# Feedback sounds

`bencho_click.wav` is rendered from [Bencho’s interaction sound](https://bencho.dev/): a 196 to 130 Hz sine sweep over 150 ms with a 900 Hz low-pass filter and an exponential gain envelope peaking at 0.07. The renderer bundles it for offline playback across navigation, chat, and theme changes.

`bencho_thinking.wav` is rendered from [Bencho’s Boot sound](https://bencho.dev/sounds): a 291 Hz sine over 360 ms with a 560 Hz low-pass filter and an exponential gain envelope with a 90 ms attack peaking at 0.043. The renderer plays it when an agent run starts.

`bencho_tool.wav` is rendered from [Bencho’s Cog sound](https://bencho.dev/sounds): a 408 Hz sine over 24 ms with a 1100 Hz low-pass filter and an exponential gain envelope with a 10 ms attack peaking at 0.061. The renderer plays it on each tool call in the home chat.
