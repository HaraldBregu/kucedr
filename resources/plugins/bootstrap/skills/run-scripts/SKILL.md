---
name: run-scripts
description: Render charts, clinical views including body maps, and dithered visuals (backgrounds, charts, UI pieces, display text, dithered images) in the user's view by running the bootstrap plugin's scripts with the run_plugin_script tool. Use when the user asks for a chart, graph or plot, a body map or where on the body something is, a clinical view (patient banner, vitals, NEWS2, lab results, medications, ECG, growth chart, AI clinical note), or a dither, dithered, halftone or pixel visual, or when numbers read better as a picture.
---

# Run scripts

Scripts render a visual result straight into the user's view. Run them with the `run_plugin_script` tool:

```json
{"name": "<script>", "input": {...}}
```

`name` is the script's folder name from the table below. Never call a script name as a tool of its own.

| Script | Use for | Fence | Reference |
| --- | --- | --- | --- |
| `chart` | bar, line, area, pie, doughnut, scatter and radar charts from data | `chart` | [references/chart.md](references/chart.md) |
| `organui` | clinical components: body map (where pain, symptoms or injuries are), dermatome map, patient banner, allergies, problems, vital signs, NEWS2, lab results, medication schedule, ECG, growth chart, anatomy, image viewer, DNA helix, AI note and review elements | `organui` | [references/organui.md](references/organui.md) |
| `dither` | any dithercn component: dithered backgrounds, charts, gauges, cards, buttons, text, images, or a custom GLSL field | `dither` | [references/dither.md](references/dither.md) |

## Steps

1. Pick the script whose "Use for" matches the request. If none matches, answer normally without a script. For a plain chart prefer `chart`; use `dither` when the user wants a dithered look or something `chart` can't draw.
2. Read that script's reference before building the input. It lists every field, the allowed values and examples.
3. Build `input` from real data in the conversation or tool results. Never invent numbers, dates or labels; ask if data is missing.
4. Call `run_plugin_script`. The result appears in the user's view on its own: don't repeat it as text or a table, add at most a one-line summary.
5. If the tool returns an error, fix the input using the error message and retry once. If it fails again, tell the user what went wrong.

## Rules

- Leave out optional fields the user didn't ask for. The defaults already look good.
- Use palette colour names (`ink`, `blue`, `purple`, `green`, `pink`, `orange`, `red`, `grey`) so the result follows light and dark mode. Use CSS colours only when the user names specific ones.
- Omit `title` unless the user wants a heading, and never invent one when they ask for no title.
- To put a script's result into a markdown file, write a fenced code block whose language is the script's fence and whose body is the same input JSON:

  ````markdown
  ```chart
  {"type":"bar","xKey":"month","series":[{"key":"sales","label":"Sales"}],"data":[{"month":"Jan","sales":10}]}
  ```
  ````
