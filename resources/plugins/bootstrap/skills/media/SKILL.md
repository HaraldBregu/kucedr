---
name: media
description: Convert, trim, resize, compress and inspect video, audio and image files on the user's machine with ffmpeg, ffprobe and ImageMagick through the bash tool. Use when the user asks to change a media file's format, cut a clip, shrink a file, pull the audio out of a video, grab frames, make a GIF, build a contact sheet, or resize and re-encode images. Inspects the input first, never overwrites the original, and verifies every output.
license: MIT
---

# Media

Work on video, audio and image files with `ffmpeg`, `ffprobe` and ImageMagick, run through the `bash` tool.

## Rules

- Never write over the input. Every output gets a new name next to the original, for example `clip.trim.mp4`, unless the user names another location.
- Pass `-n` to every `ffmpeg` command so it refuses to replace an existing file. If the output name is taken, pick another name; do not delete the existing file.
- Do not use `magick mogrify`: it edits files in place.
- Quote every path. File names often contain spaces.
- Inspect before you act and verify after you act. Do not report success from the exit code alone.
- Start a job that will run for minutes with the `process` tool instead of blocking in `bash`, and tell the user it is running.

## 1. Check the tools

```bash
command -v ffmpeg ffprobe magick
```

- ImageMagick 7 provides `magick`. If only version 6 is present (`command -v convert identify montage`), use `convert`, `identify` and `montage` in place of `magick`, `magick identify` and `magick montage`.
- If a tool is missing, stop and tell the user which one and how to install it. Install only after they agree.
  - macOS: `brew install ffmpeg imagemagick`
  - Windows: `winget install Gyan.FFmpeg` and `winget install ImageMagick.ImageMagick`
  - Debian or Ubuntu: `sudo apt install ffmpeg imagemagick`

## 2. Inspect the input

Video or audio:

```bash
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of json "in.mp4"
```

Image:

```bash
magick identify "in.png"
```

Note the duration, resolution, codecs and file size. Use them to choose the recipe and to compare with the result. If the request is ambiguous (target size, quality, which time range), ask with the `ask` tool before encoding.

## 3. Recipes

Replace `in.*` and `out.*` with real quoted paths. Times use `HH:MM:SS` or seconds.

### Video and audio

Convert to a widely playable MP4 (H.264 video, AAC audio):

```bash
ffmpeg -n -i "in.mov" -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "out.mp4"
```

Trim without re-encoding (fast; the cut lands on the nearest keyframe). `-ss` is the start, `-t` is the length:

```bash
ffmpeg -n -ss 00:00:10 -i "in.mp4" -t 15 -c copy "out.mp4"
```

Trim with frame-accurate cuts (re-encodes):

```bash
ffmpeg -n -ss 00:00:10 -i "in.mp4" -t 15 -c:v libx264 -crf 20 -c:a aac "out.mp4"
```

Resize to a given width and keep the aspect ratio (`-2` keeps the height even):

```bash
ffmpeg -n -i "in.mp4" -vf "scale=1280:-2" -c:v libx264 -crf 23 -c:a copy "out.mp4"
```

Compress: raise `-crf` (23 is the default, 28 is visibly smaller, higher is worse) and optionally scale down:

```bash
ffmpeg -n -i "in.mp4" -vf "scale=-2:720" -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 96k "out.mp4"
```

Extract audio as MP3:

```bash
ffmpeg -n -i "in.mp4" -vn -c:a libmp3lame -q:a 2 "out.mp3"
```

Extract the audio stream unchanged (choose the extension that matches the codec `ffprobe` reported, for example `.m4a` for AAC):

```bash
ffmpeg -n -i "in.mp4" -vn -c:a copy "out.m4a"
```

One frame at a timestamp:

```bash
ffmpeg -n -ss 00:00:05 -i "in.mp4" -frames:v 1 -q:v 2 "frame.jpg"
```

One frame per second into a new folder (create the folder first with `mkdir`):

```bash
ffmpeg -n -i "in.mp4" -vf "fps=1" "frames/frame_%04d.png"
```

GIF with a generated palette:

```bash
ffmpeg -n -ss 00:00:03 -t 5 -i "in.mp4" -vf "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" "out.gif"
```

Contact sheet from a video (one frame every 10 seconds, 4 columns by 3 rows):

```bash
ffmpeg -n -i "in.mp4" -vf "fps=1/10,scale=320:-1,tile=4x3" -frames:v 1 "sheet.png"
```

Set the `fps` interval to about `duration / (columns * rows)` so the sheet covers the whole file.

### Images

Convert the format:

```bash
magick "in.png" "out.jpg"
```

Resize to fit inside 1600x1600, never enlarging, with JPEG quality 82:

```bash
magick "in.jpg" -auto-orient -resize "1600x1600>" -quality 82 "out.jpg"
```

Remove metadata (EXIF, location):

```bash
magick "in.jpg" -strip "out.jpg"
```

Contact sheet from a folder of images:

```bash
magick montage "photos/"*.jpg -thumbnail 320x320 -tile 4x -geometry +4+4 "sheet.jpg"
```

For many files, loop in `bash` and write each result into a new output folder; never into the source folder under the same names.

## 4. Verify the output

Run the same `ffprobe` or `magick identify` command on the output and check:

- the file exists and its size is greater than zero;
- duration, resolution and codec match what was asked;
- for compression, the output is smaller than the input. If it is larger, say so and offer a higher `-crf` or a smaller scale.

If `ffmpeg` fails, read the last lines of its output, fix the cause (unknown encoder, wrong stream, existing output name) and rerun. Do not retry the same command unchanged.

## 5. Report

Answer in this form:

```
Input:  <path> — <format>, <width>x<height>, <duration>, <size>
Output: <path> — <format>, <width>x<height>, <duration>, <size>
Change: <one line: what was done and the size difference>
Original left untouched.
```

Add the exact command you ran when the user is likely to repeat it.
