# 15. Local models and offline use

Part of the [Roadmap](README.md). Status: 15.1 built 2026-11-25; the rest proposal.

Using Kucedr with models that run on the user's own machine, with nothing sent to a cloud provider.

## What exists today

- A keyless Ollama plugin is bundled (`resources/plugins/ollama`).
- Setup can finish with a local model and no key (15.1).
- Downloading models from inside the app is designed in [Plugin system](../PLUGIN_SYSTEM.md) and
  not built.
- Knowledge search needs an embedding model; whether a local one is available is _not verified_.
- There is no offline detection anywhere in the app.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 15.1 | Setup with a local model | Finish first-run setup by choosing a model already on the machine, with no key | Built 2026-11-25. The model step also continues when a keyless provider (`authentication: "none"` with a `modelsUrl`, read from its manifest) lists at least one model; otherwise it says "Add a model provider API key or run a local model to continue." The chat step lists those providers' live models (`src/renderer/src/pages/start/StartPage.tsx`, `setupConstants.ts`). Checked in the app against a mock server on Ollama's port: setup finished with the local model and a chat got its reply. Not checked against a real Ollama. Setup does not yet warn that local models are weaker at tool use | S |
| 15.2 | Model downloads | Browse, download and remove local models from Settings, with size and progress | The download design in [Plugin system](../PLUGIN_SYSTEM.md) | M |
| 15.3 | Local knowledge | Knowledge indexing and search with a local embedding model | The local knowledge store | M |
| 15.4 | Offline behaviour | The app says it is offline, keeps local models working, and marks which features need a connection | Offline messages ([User experience](EXPERIENCE.md), 3.6) | S |
| 15.5 | Built-in runtime | Local models run without installing Ollama | Later phase 1 of [Plugin system](../PLUGIN_SYSTEM.md) | L |

## Open decisions

- **Order.** Recommended: 15.1 first. It is small, and a local model is also the most private way
  to use the app.
- **Quality expectations.** Local models are weaker at tool use than the large cloud models; setup
  should say so, not hide it.
- **Provider rule.** Local model behaviour stays in plugin manifests, like every other provider.
- **Pairs with** the local-only switch ([Network shield](SHIELD.md), 13.9).
