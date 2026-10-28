# draw

Render a static, hand-drawn Excalidraw diagram, flowchart, sketch or wireframe. Use `chart` for plots of numeric data. The drawing fits the container automatically and follows light and dark mode.

Call `run_plugin_script` with `name: "draw"` and these input fields:

- `elements`: required, 1–200 Excalidraw element skeletons. Each needs `type`, `x` and `y` (finite coordinates in pixels).
- `title`: optional heading. Omit it unless requested.
- `description`: optional text below the heading; also provides an accessible name for an untitled drawing.

Supported elements:

| Type                              | Fields                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rectangle`, `ellipse`, `diamond` | Optional `width`, `height` (default 100), and `label: { "text": "..." }`. Give labelled shapes enough space for their text.                                         |
| `text`                            | Required `text`; optional `fontSize` and `textAlign` (`left`, `center`, `right`).                                                                                   |
| `line`, `arrow`                   | Optional `width` (default 100), `height` (default 0), or `points` (at least two `[x, y]` pairs relative to the element's position). Arrows can also have a `label`. |

Optional Excalidraw styling includes `strokeColor`, `backgroundColor`, `fillStyle` (`hachure`, `cross-hatch`, `solid`), `strokeStyle` (`solid`, `dashed`, `dotted`), `strokeWidth`, `roughness` (0–2), `opacity` (0–100), `angle` (radians), and `seed`. Use positive shape dimensions and font sizes. Text uses the bundled Virgil handwriting font.

Use light-mode CSS colours such as `#1e1e1e` for ink, `#1971c2` for blue strokes, and `#a5d8ff` for blue fill. Use `fillStyle: "solid"` for solid fills. Excalidraw adjusts the drawing for dark mode automatically. Omit colours for default ink and transparent fill.

To connect shapes, give each a unique non-empty `id` and set an arrow's `start: { "id": "source" }` and `end: { "id": "target" }`. References must point to ids in the same `elements` array. Position shapes with clear gaps, then place the arrow between them. Element order controls paint order. Labels are plain text. Images, external embeds, editing and saved scenes are not supported.

Connected flow:

```json
{
	"elements": [
		{
			"id": "request",
			"type": "rectangle",
			"x": 0,
			"y": 20,
			"width": 160,
			"height": 80,
			"label": { "text": "Request" }
		},
		{
			"id": "result",
			"type": "rectangle",
			"x": 300,
			"y": 20,
			"width": 160,
			"height": 80,
			"label": { "text": "Result" }
		},
		{
			"type": "arrow",
			"x": 170,
			"y": 60,
			"width": 120,
			"height": 0,
			"start": { "id": "request" },
			"end": { "id": "result" }
		}
	]
}
```

Simple wireframe:

```json
{
	"elements": [
		{ "type": "rectangle", "x": 0, "y": 0, "width": 480, "height": 280, "roughness": 0 },
		{
			"type": "rectangle",
			"x": 16,
			"y": 16,
			"width": 448,
			"height": 44,
			"label": { "text": "Header" },
			"roughness": 0
		},
		{
			"type": "rectangle",
			"x": 16,
			"y": 76,
			"width": 120,
			"height": 188,
			"label": { "text": "Navigation" },
			"roughness": 0
		},
		{
			"type": "rectangle",
			"x": 152,
			"y": 76,
			"width": 312,
			"height": 188,
			"label": { "text": "Content" },
			"roughness": 0
		}
	]
}
```

Shapes and free-standing text:

```json
{
	"elements": [
		{
			"type": "ellipse",
			"x": 0,
			"y": 40,
			"width": 140,
			"height": 100,
			"backgroundColor": "#a5d8ff",
			"fillStyle": "solid",
			"label": { "text": "Idea" }
		},
		{
			"type": "diamond",
			"x": 240,
			"y": 20,
			"width": 180,
			"height": 140,
			"label": { "text": "Review" }
		},
		{
			"type": "line",
			"x": 150,
			"y": 90,
			"points": [
				[0, 0],
				[80, 0]
			]
		},
		{ "type": "text", "x": 40, "y": 180, "text": "Explore, then refine", "fontSize": 24 }
	]
}
```

For a Markdown file, use a `draw` fence containing the same input JSON.
