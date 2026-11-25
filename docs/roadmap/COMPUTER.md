# 24. Computer use

Part of the [Roadmap](README.md). Status: proposal.

The agent works in apps on the user's computer, outside the browser pane. It reads what is on screen, clicks, types and reports back, and the user can watch it and stop it. This was checked against the checkout and the Cua repository on 2026-11-26.

## What exists today

- Nothing controls the desktop. No code in `src` moves the mouse or types outside the browser pane. No dependency injects OS input or reads the accessibility tree (`package.json`).
- The browser pane (3.9, 3.12) is the closest thing. `use_web_browser` drives a `WebContentsView` through its debugger (`src/main/agent/tools/web/browser/act.ts`, `press.ts`). The model sees a text snapshot with element refs. Screenshots go to the Library and only their path is returned (`src/main/agent/tools/web/use_web_browser.ts`). The pane has Stop and tab ownership per chat. The shared desktop has neither.
- The agent cursor rule (3.11) says the user's own mouse is never moved or blocked ([User experience](EXPERIENCE.md)). Input on the real desktop breaks that rule unless the driver works in the background.
- No tool can show the model an image:
  - Tool results become text in the transcript (`src/main/models/adapters/llm/llm_shared.ts`).
  - The OpenAI paths replace images with `[binary content]`.
  - MCP output replaces base64 data with a placeholder (`src/main/agent/tools/mcp/output.ts`).
  - Only the Anthropic Messages builder already serializes image tool results, and nothing produces them yet.
- How tools are wired today:
  - Tools are registered in `builtinTools()` (`src/main/agent/runner/run_builtin_tools.ts`).
  - Tools used only on explicit request are listed in `src/main/agent/system/explicit.ts`.
  - `capability.approval: true` asks on every call and is denied in runs with no window (`src/main/agent/execution/capability.ts`).
  - Voice gets every builtin tool unless one is excluded (`src/shared/agent_tools.ts`).
- Screen capture exists for the recorders through `desktopCapturer` (`src/main/agent/tools/system/capture.ts`), with a Screen Recording status check. There is a deep link to the Accessibility settings pane, but Accessibility trust is never checked (`src/main/ipc/app.ts`).
- Builds are unsigned (`electron-builder.json`, 6.1). macOS grants may not survive updates _(from docs)_.
- Plugin stdio MCP servers (`mcp/<id>/mcp.json`) run as host processes and are refused in Privacy Mode (`src/main/mcp/mcp_client_build_transport.ts`). The command sandbox blocks AppleEvents and localhost (`src/main/agent/sandbox.ts`), so a driver started through `bash` would fail.
- No model manifest declares computer use or image tool results (`src/shared/model_types.ts`).

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 24.1 | Desktop driver | A bundled driver that lists apps and windows, reads a window's accessibility tree, clicks, types and presses keys. macOS first | Cua Driver (see [Cua](#cua)), a utility process | L |
| 24.2 | Computer tool | Ask the chat to do something in a desktop app. The agent uses a computer tool that any tool-calling model can use, working from the accessibility tree the way the browser tool works from its snapshot | 24.1, `builtinTools()`, `explicit.ts` | M |
| 24.3 | Permissions setup | Settings shows whether Accessibility and Screen Recording are granted, says why they are needed, opens the right pane, and says when a relaunch is needed | The Screen Recording check and Accessibility deep link in `src/main/ipc/app.ts`, signed builds (6.1) | M |
| 24.4 | Approval, indicator and Stop | The agent asks once per app per chat before acting in it. An indicator shows while it acts, and Stop ends it at once | The approval card (needs a new grant scope, since `approval: true` asks on every call), the pane's Stop | M |
| 24.5 | One chat at a time | Only one chat controls the desktop at a time. Another chat is told the desktop is busy | The pane's tab ownership | S |
| 24.6 | Background control | The agent works without moving the user's pointer or taking focus where the platform allows. Where it cannot, it says so and asks first | 24.1's background delivery mode, the cursor rule (3.11) | M |
| 24.7 | Screenshots to the model | Models that read images see the window as well as its tree. Screenshots are also saved to the Library | Image tool results through every adapter and through MCP output, a generic manifest field | M |
| 24.8 | Provider computer tools | Models with a native computer tool use it, mapped onto the driver. Tool names, coordinates and scaling come from the model manifest | 24.7, plugin manifests | L |
| 24.9 | Screen text marked untrusted | Text read from the screen is labelled untrusted before the model reads it, like web pages | Untrusted content marking (13.10) | S |
| 24.10 | Separate computer | The agent works in a virtual machine instead of on the user's desktop, so it cannot touch the user's own files or apps | Model downloads (15.2) for the image download, Lume on Apple silicon or a container | L |

## Open decisions

- **Driver.** Recommended: embed Cua Driver and pin one exact version. Writing our own executor for three operating systems would repeat its work. It is a new dependency (see [Cua](#cua)).
- **How it runs.** There are three ways:
  - the in-process SDK (`CuaDriver.create()`);
  - the documented embedded daemon (`EmbeddedCuaDriverHost`);
  - a driver the user installs, added as an MCP plugin.

  Recommended: the in-process SDK, run inside a utility process. It needs only the npm native package. It appears to send no telemetry. A native crash does not take down the main process. If macOS attributes the permission grants wrongly, fall back to the embedded daemon _(not verified)_. Use the MCP route only to try the driver out. Images are stripped today, Privacy Mode refuses stdio MCP, and on macOS `cua-driver mcp` may proxy to a separately installed driver app.
- **Real desktop or virtual machine first.** Recommended: the real desktop, one app at a time, with approval (24.1–24.6). A macOS virtual machine (24.10) needs Apple silicon, about 50 GB per guest, and a download path that is not built yet.
- **Text or pixels first.** Recommended: the accessibility tree first (24.2). It works with today's text-only transcript and with any tool-calling model. Screenshots (24.7) and native provider tools (24.8) come later. Whether the driver can act on an element without coordinates is _not verified_.
- **Declaring support per model.** Recommended: a generic manifest field for image tool results first. Later, add one for a native computer tool and its coordinate system. Anthropic's tool uses screenshot pixels and Gemini uses a 0–999 or 0–1000 grid _(docs disagree)_. Provider tool names, beta headers and scaling stay in manifests, not in `src`.
- **Approval granularity.** Recommended: once per app per chat, never "always". Asking on every click makes the tool unusable, and no approval at all is too much for the user's own apps.
- **Voice and tasks.** Recommended: off in voice and off in tasks by default. A task cannot ask for approval, so the tool would be denied there anyway.
- **Platforms.** Recommended: macOS first, then Windows. Linux support is "with limits" (X11, AT-SPI), and Wayland is opt-in.

## Cua

[Cua](https://cua.ai) ([repository](https://github.com/trycua/cua)) was read at commit 4a865db on 2026-11-26. It has changed a lot since 2025. Cua Cloud and Fleets shut down on 2026-10-18 ([notice](https://github.com/trycua/cua/blob/main/docs/content/docs/cua-sdk/guides/cua-cloud-ended.mdx)). The old Python Computer and Agent packages are deprecated, and `cuabot` is marked "do not run".

What it ships now:
- **Cua Driver** (MIT) is a Rust driver for native apps on macOS 14+, Windows 10/11 and Linux.
  - You reach it through `cua-driver mcp` (stdio), a CLI, or typed Python and TypeScript SDKs.
  - Its tools include `list_apps`, `list_windows`, `get_window_state` (accessibility tree and screenshot), `click`, `type_text`, `press_key`, `hotkey`, `scroll`, `drag` and `set_value`.
  - Actions default to background delivery.
  - It has three permission modes: standard, bounded (a reviewed tool list) and unrestricted.
- **Lume** (MIT) runs macOS and Linux VMs on Apple silicon. It ships only for darwin-arm64.
- **The `cua` SDK and CLI** (MIT) create sandboxes in Docker, Hyper-V, QEMU or Lume, or in the user's own cloud account. They call no model. Both are alpha, and the npm package is under two months old.
- **Cua Spaces** (FSL-1.1-MIT, with paid tiers) is a desktop app and daemon for remote computers.

What fits:
- `@trycua/cua-driver` (0.62.1) supports Electron. `CuaDriver.create()` runs in process. `EmbeddedCuaDriverHost` starts a private daemon whose permissions belong to the host app. Neither needs Python.
- Local use needs no Cua account or API key. The driver calls no model, so our agent loop and providers stay as they are.
- Its accessibility tools let models without a native computer tool drive apps through ordinary tool calls.

What does not fit:
- Cua's own agent loops, which are deprecated.
- The `cua` sandbox SDK: alpha, with an unpacked native package of about 272 MB on macOS.
- Cua Spaces: FSL-licensed, a separate product, and its macOS installer needs macOS 26.
- The optional `cua-perception` extension and `cua-som`, which are AGPL. The default driver works without them.

Licence:
- The npm wrapper is MIT. Each native package is "MIT AND MPL-2.0". Both go in the third-party notices (6.4) ([licensing](https://github.com/trycua/cua/blob/main/legal/LICENSING.md)).
- "Cua" and "Cua Driver" are trademarks. We may say we use the driver, but we may not name a feature after it ([trademarks](https://github.com/trycua/cua/blob/main/legal/TRADEMARKS.md)).
- A hosted service built on Spaces would need a commercial licence. That does not apply to the driver.

Dependencies and size:
- The npm wrapper is about 1 MB.
- There is one native package per platform. Unpacked, it is about 45 MB on macOS arm64, 34 MB on Linux x64 and 29 MB on Windows x64.
- The embedded daemon route also needs the driver binary from the GitHub release, about 44 MB on macOS, so about 90 MB in total there.
- It depends on a pinned prerelease runtime (`@ubjs` 0.31.0-3).
- The binary must sit outside ASAR and be signed before notarization ([TypeScript README](https://github.com/trycua/cua/blob/main/libs/cua-driver/typescript/README.md)).

Risks:
- **Telemetry.** The driver sends content-free usage events to PostHog EU by default, with a persistent installation ID, and it keeps sending in CI. Kucedr sends no telemetry ([Not planned](README.md#not-planned)), so telemetry must be off.
  - The embedded host clears the environment. It forwards `CUA_DRIVER_RS_TELEMETRY_ENABLED` and `CUA_TELEMETRY_ENABLED` but not `DO_NOT_TRACK`.
  - The in-process SDK has no telemetry code _(not verified in a running build)_ ([telemetry.rs](https://github.com/trycua/cua/blob/main/libs/cua-driver/rust/crates/cua-driver/src/telemetry.rs)).
- **Update check.** When `mcp`, `serve` or `doctor` start, they contact cua.ai and GitHub by default. `CUA_DRIVER_RS_UPDATE_CHECK=false` turns this off.
- **Churn.** Driver releases went from 0.56.4 to 0.62.1 between 2026-11-21 and 2026-11-24, all marked prerelease. Some tools are removed after 2026-11-26, and the docs lag the code. Pin one exact version and upgrade on purpose.
- **Windows installer.** The standalone Windows installer registers a hidden, elevated logon task ([#8102](https://github.com/trycua/cua/issues/8102)). Embedding skips that installer. Whether embedded mode on Windows avoids the task completely is _not verified_.
- **Project load.** The repository had 1,597 open issues and pull requests on 2026-11-26.
- **macOS permissions.** Kucedr must request Accessibility and Screen Recording itself, and the grants are unstable while builds are unsigned (6.1).

Alternatives looked at:
- [Peekaboo](https://github.com/openclaw/Peekaboo) (MIT, MCP) supports macOS 15+ only and could serve as a macOS fallback.
- nut.js prebuilt packages now need a paid subscription.
- Writing our own bindings means three different accessibility APIs.

Provider tools for 24.8: [Anthropic computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) and [OpenAI computer use](https://developers.openai.com/api/docs/guides/tools-computer-use). Which OpenAI model ids support the tool is _not verified_.
