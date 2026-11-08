# Bundled plugins (`resources/plugins/`)

All bundled plugins load with `builtIn: true`: they can be disabled but not removed, and a newer user copy with the same id replaces them (see [loading.md](loading.md)).

| Plugin | Version | Category | Contributes |
|---|---|---|---|
| `bootstrap` | 1.4.0 | CORE | apps, skills, scripts, modes |
| `anthropic` | 1.1.0 | LLM | provider: 11 Claude models |
| `openai` | — | LLM | provider: 30 models (chat, image, realtime, transcription, TTS, embeddings) |
| `xai` | — | LLM | provider: 15 models (Grok chat, image, video, voice, STT/TTS) |
| `deepseek` | — | LLM | provider: 2 models |
| `iteracompute` | — | LLM | provider: 1 model + `remote` discovery |
| `openrouter` | — | LLM | provider: `auto` + `remote` discovery |
| `ollama` | 1.0.1 | LLM | provider: `auto` local discovery, `authentication: none` |
| `elevenlabs` | — | — | provider: 16 voice, music, sound-effect, and transcription models |
| `brave` | 1.0.1 | SEARCH | provider: `services/web-search` (`SEARCH_ENGINE`) |
| `tavily` | 1.0.1 | SEARCH | provider: `services/web-search` and remote `mcp/web-search` (OAuth) |

Model counts are the folders under `models/`. See each plugin's `manifest.json` for versions marked "—".

## `bootstrap` contents

| Kind | Items |
|---|---|
| `apps` | `arcade` (extension; Space Invaders, Breakout, Asteroids, Lunar Lander, Galaga, Pac-Man, Snake), `tetris`, `triangle`, `taxes` |
| `skills` | `docx`, `pdf`, `pptx`, `xlsx` |
| `scripts` | `chart`, `maps`, `draw`, `dither`, `organui` (UI); `cloud-sync-s3` (STORAGE) |
| `modes` | `plan`, `goal` (see [modes.md](modes.md)) |

Script folders keep their `src/`, `package.json`, and sometimes `node_modules/` and `example/` for development. Only the built `dist/` entry and `instructions.md` are used at runtime. The `node_modules/.bin` links are why bundled plugins skip the no-links check.

## Adding a bundled plugin

1. Create `resources/plugins/<id>/manifest.json` (`schemaVersion: 5`, `id` = folder name).
2. Add icons under `assets/` and at least one contribution folder.
3. Build any script entries; the app runs the built entry as-is.
4. In development the bundled root is watched, so changes show up without restarting.

Bundled plugins skip `validatePluginContents()` (it runs only at install), so a broken bundled app, script, or mode just doesn't appear. Check the console for `[plugins]` warnings.
