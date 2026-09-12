# Kucedr Landing Page Build Prompt

Build a polished, responsive product landing page for **Kucedr**, a cross-platform desktop AI copilot that turns conversations into actions and turns useful work into reusable knowledge.

This document is the source prompt for the page. Use the approved positioning and copy below. Keep every product claim consistent with the current implementation, especially the distinctions between Skills, the Knowledge Base, and Apps.

## Page objective

The page should help a technically curious knowledge worker, developer, researcher, or AI power user understand three things within the first screen:

1. Kucedr is a desktop agent that can act, not just chat.
2. Kucedr can reuse workflows and ground answers in the user's own material.
3. The user chooses the providers, knowledge sources, and apps behind the experience.

The primary conversion is downloading Kucedr. The secondary conversion is viewing the project on GitHub. Documentation is the tertiary path.

Use these destinations unless the host project provides equivalent route constants:

- **Download Kucedr:** `https://github.com/HaraldBregu/kucedr/releases`
- **View on GitHub:** `https://github.com/HaraldBregu/kucedr`
- **Read the docs:** `https://github.com/HaraldBregu/kucedr/tree/main/docs`

Do not add pricing, testimonials, customer logos, usage counters, or a newsletter form. No verified source material exists for them.

## Product positioning

**Category:** desktop AI copilot and tool-using personal agent.

**Existing product tagline:** Your desktop AI copilot for everyday tasks.

**Landing-page promise:** Kucedr connects action, reusable expertise, source-grounded retrieval, and focused mini-apps in one desktop assistant.

**Core narrative:**

```text
Ask Kucedr to do the work
  -> activate the right reusable Skill
  -> retrieve evidence from the Knowledge Base
  -> use focused Apps when the workflow needs a dedicated interface
```

Use the user-facing name **Knowledge Base** in application navigation and marketing copy. Technical documentation may describe its retrieval architecture as RAG.

## Approved page structure and copy

### 1. Navigation

Use a compact sticky navigation bar.

- Kucedr logo and wordmark on the left.
- Anchor links: **Product**, **Skills**, **Knowledge**, **Apps**, **Control**.
- Secondary action: **GitHub**.
- Primary action: **Download**.

On mobile, preserve the Download action and move anchor links into an accessible menu.

### 2. Hero

**Eyebrow**

```text
Desktop AI copilot for macOS, Windows, and Linux
```

**Headline**

```text
Turn conversations into action. Turn your work into lasting knowledge.
```

**Supporting copy**

```text
Kucedr works with your files, tools, and chosen AI providers—then makes the useful parts reusable through Skills, semantic document search, and custom Apps.
```

**Actions**

- Primary: **Download Kucedr**
- Secondary: **View on GitHub**

**Supporting line**

```text
Bring your own providers. Keep control of the setup. Follow every tool action in the conversation.
```

Show three concise capability labels near the hero visual:

- Reusable Skills
- Semantic Knowledge Base
- Custom Apps

The hero visual should look like the real Kucedr desktop application, not a generic browser chat mockup. Show one request moving through visible activity states such as loading a skill, searching knowledge, and updating a local file. Do not invent a marketplace, team workspace, or autonomous background task result.

### 3. Product foundation

**Section heading**

```text
One assistant, from request to result.
```

**Section copy**

```text
Type or speak a request, attach images or PDFs, and let Kucedr work across files, commands, the web, browser interactions, and generated media. Tool activity streams into the conversation, while permission controls govern sensitive file and command actions.
```

Present a short four-step flow:

1. **Ask** — Start with a natural-language request and the context that matters.
2. **Act** — Kucedr selects tools, works through the task, and shows its activity.
3. **Ground** — The assistant retrieves relevant source excerpts from the Knowledge Base.
4. **Reuse** — Save the workflow as a Skill or give it a focused interface through an App.

Use this section as context, not as a complete inventory of every Kucedr feature.

### 4. Skills

Set the section anchor to `skills`.

**Eyebrow**

```text
Reusable expertise
```

**Heading**

```text
Teach Kucedr the way you work.
```

**Body copy**

```text
Turn repeatable workflows into portable Agent Skills. Kucedr routes requests with lightweight skill metadata, loads the full instructions only when they are relevant, and can use the scripts, references, and assets bundled with each skill.
```

**Feature points**

- Import agentskills.io-compatible folders built around `SKILL.md`.
- Let Kucedr select an enabled skill by intent, or request one explicitly.
- Inspect a skill's identity, authoring metadata, tool requirements, connectors, and tags.
- Enable, disable, download, refresh, or delete local skills from Settings.
- See a clear activity state in chat whenever Kucedr loads a skill.

**Supporting callout**

```text
Full instructions arrive only when the task needs them—reusable expertise without placing every playbook into every prompt.
```

For the visual, show the installed Skills list beside a chat activity row that reads **Using skill**. Optional supporting files may appear as small script, reference, and asset cards. Do not imply that Kucedr includes a skill marketplace, a visual skill builder, semantic skill search, or runtime enforcement of every declared metadata field.

### 5. Knowledge system

Set the section anchor to `knowledge`.

**Eyebrow**

```text
Source-grounded retrieval
```

**Heading**

```text
Find the source. Keep the insight.
```

**Intro copy**

```text
The Knowledge Base retrieves relevant excerpts from indexed text so Kucedr can answer with material from the folders you choose.
```

#### Knowledge Base

**Card heading**

```text
Search your documents by meaning.
```

**Card copy**

```text
Choose one or more folders of text, create a semantic index with your selected embedding provider and Pinecone, and let Kucedr retrieve matching excerpts with their source paths. Generate the index on demand, keep it refreshed on a schedule, and test searches directly in Settings.
```

**Feature points**

- Recursively indexes readable UTF-8 text while skipping binary files.
- Uses the same embedding model for indexing and later queries.
- Gives the main assistant relevant excerpts, paths, and relevance scores.
- Supports manual generation and scheduled full index rebuilds.
- Rejects common credential files and high-confidence secret content before indexing.

Use **Knowledge Base** in the interface. Technical copy may say **RAG-powered semantic retrieval**. Do not describe this feature as local-only, incremental, compatible with PDFs or office documents, or independent of Pinecone.

### 6. Apps

Set the section anchor to `apps`.

**Eyebrow**

```text
Focused interfaces
```

**Heading**

```text
Make Kucedr fit the workflow.
```

**Body copy**

```text
Apps are local web mini-apps that open in their own Kucedr windows and can use the exposed app API. Build a focused interface for a dashboard, workspace utility, or repeatable workflow without turning the main conversation into a control panel.
```

**Feature points**

- Import one or more app folders from Settings.
- Use a validated `manifest.json` or standard `package.json` with a local HTML entry.
- Browse installed apps by title, description, and category.
- Inspect metadata, open an app in a dedicated resizable window, or delete it with confirmation.
- Launch installed apps from Settings, the native app menu, or the tray menu.
- Build typed in-app integrations with `@kucedr/sdk`.

**Trust note**

```text
Apps run in Electron's sandboxed web runtime, but installed code can access broad Kucedr APIs. Install apps only from sources you trust.
```

For the visual, show the installed Apps list opening a separate utility window. Do not claim an app marketplace, signed apps, per-app permissions, enable/disable controls, or hot reload of an already-open app window.

### 7. Control and privacy

Set the section anchor to `control`.

**Heading**

```text
Your setup. Your providers. Your control.
```

**Body copy**

```text
Kucedr stores provider keys, settings, conversations, workspace data, Skills, Apps, and generated wiki files on the user's machine. The user selects the providers and connected services behind chat, speech, media, search, embeddings, and knowledge generation.
```

**Control points**

- File writes, edits, patches, and command execution follow the agent permission policy.
- Sensitive actions can surface **Deny**, **Allow once**, and **Always allow** choices.
- Tool activity remains visible in the conversation.
- The app uses Electron sandboxing, context isolation, disabled Node integration, and web security.
- Kucedr runs on macOS, Windows, and Linux, with light, dark, and system themes.

Include this disclosure in readable body text, not hidden in a tooltip or footer:

```text
Local storage does not mean every operation stays on-device. Prompts, attachments, source text, document chunks, and tool data may be sent to the AI providers, Pinecone index, MCP servers, websites, or other connected services required for a requested feature.
```

Do not use **fully private**, **offline**, **on-device AI**, **zero data leaves your machine**, **end-to-end encrypted**, **enterprise-grade security**, or regulatory-certification claims.

### 8. Final call to action

**Heading**

```text
Build an assistant around the way you work.
```

**Supporting copy**

```text
Start with a conversation. Add the skills, knowledge, providers, and apps that make Kucedr yours.
```

**Actions**

- Primary: **Download Kucedr**
- Secondary: **Explore the source**

Add a compact platform line: **Available for macOS, Windows, and Linux. Open source under the MIT License.**

### 9. Footer

Include links for GitHub, Documentation, Releases, Security, Contributing, and License. Keep the footer simple and use the repository as the source of truth.

## Visual direction

Use Kucedr's existing product identity rather than generic AI imagery.

- Use `resources/icons/icon.svg` as the canonical brand mark.
- Start with near-black or deep graphite foundations and restrained off-white surfaces.
- Carry the mark's crisp monochrome contrast into focus rings, active paths, and restrained graphic details.
- Mirror the desktop application's clean borders, compact controls, calm spacing, and rounded panels.
- Use motion and contrast to signal intelligence moving through the system; do not cover every card in gradients or glass effects.
- Prefer real product UI compositions, source-page diagrams, file cards, tool activity, and app windows over abstract brains, robots, stock photos, or floating chat bubbles.
- Use a modern sans-serif for interface and marketing copy and a restrained monospace for paths, commands, evidence IDs, and technical labels.

The page should feel capable, precise, and personal. Avoid a noisy cyberpunk aesthetic.

## Motion and interaction

- Use subtle scroll reveals and short transitions only where they clarify the product flow.
- Animate the hero activity sequence once, then settle into a readable final state.
- Let the Knowledge section show selected files becoming ranked excerpts that ground an answer.
- Make cards respond gently to hover without large tilts, parallax, or cursor-following effects.
- Respect `prefers-reduced-motion` and keep all content available without animation.

## Responsive and accessibility requirements

- Use semantic landmarks and one page-level H1.
- Preserve the content order and messaging hierarchy on mobile.
- Meet WCAG AA contrast for text, controls, focus indicators, and links.
- Make navigation, menus, and calls to action fully keyboard accessible.
- Do not rely on color alone to distinguish Skills, Knowledge Base, and Apps.
- Give product images meaningful alternative text; mark decorative glow and connector elements as decorative.
- Keep paragraph width readable and avoid horizontal scrolling at 320 CSS pixels.

## SEO metadata

**Title**

```text
Kucedr — Desktop AI that turns knowledge into action
```

**Description**

```text
Kucedr is a cross-platform desktop AI copilot with reusable Skills, semantic document search, and custom Apps.
```

Use the same core message for Open Graph and social metadata. Use the Kucedr icon or a product-composition image, not a fabricated customer or performance statistic.

## Accuracy guardrails

The finished page must not imply capabilities that are only planned, partial, or absent.

- Do not claim a hosted service, team collaboration, multi-tenant knowledge, or cloud account sync.
- Do not claim that all AI or knowledge processing happens locally.
- Do not call the Knowledge Base incremental; current indexing rebuilds its Pinecone index.
- Do not claim arbitrary vector-database support; the current runtime uses Pinecone.
- Do not claim a Skills or Apps marketplace.
- Do not claim that every Skill metadata declaration is enforced at runtime.
- Do not claim that Apps are signed, verified, permission-isolated, or safe to install from untrusted sources.
- Do not advertise app hot reload, enable/disable controls, or preinstalled example apps.
- Do not market incomplete scheduled-agent execution or database features on this page.
- Do not invent download counts, supported-company logos, benchmarks, customer quotes, or awards.

## Acceptance criteria

The landing page is complete when:

- The hero explains Kucedr's category, action capability, and knowledge advantage without scrolling.
- Skills, Knowledge Base, and Apps each receive a distinct, implementation-accurate explanation.
- The privacy section distinguishes local storage from processing by configured external services.
- Primary and secondary calls to action are visible in the hero and final section.
- The result works across desktop, tablet, and mobile and meets the accessibility requirements above.
- No section depends on fabricated social proof, placeholder statistics, or unimplemented product behavior.

## Implementation references

Use these repository sources to validate final copy and product visuals:

- [Product overview](../README.md)
- [Feature reference](FEATURES.md)
- [Skills settings](../src/renderer/src/pages/settings/pages/skills/Page.tsx)
- [Skill loading](../src/main/agent/tools/skill_load.ts)
- [RAG settings](../src/renderer/src/pages/settings/pages/rag/Page.tsx)
- [Knowledge search tool](../src/main/agent/tools/knowledge/rag.ts)
- [Apps settings](../src/renderer/src/pages/settings/pages/apps/Page.tsx)
- [App window](../src/main/apps/app_render.ts)
- [Kucedr SDK](../packages/sdk/README.md)
- [Brand mark](../resources/icons/icon.svg)
