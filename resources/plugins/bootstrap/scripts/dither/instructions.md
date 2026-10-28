# dither

Renders one dithercn component: a dithered background, chart, interface piece, display text or image. Input:

```json
{"component": "<id>", "props": {...}, "title": "optional", "description": "optional"}
```

- `component`: one of the ids below. Use `shader` for a custom GLSL field.
- `props`: the component's props. Only the props marked "needs" are required; every other prop has a default that already looks good, so pass only what the user asked for.
- `title`, `description`: optional heading and line under it. Omit the title unless the user wants one.

Pick by what the user asked for: a hero or section background → a background; numbers → a chart; a UI element → interface; a headline → text; a photo or logo → images. Use the closest match, never a merely nearby one.

## Shared props

These mean the same on every component that lists them under "Shared":

- Colours (`color`, `accent`, `background`, `highlight`, `tipColor`, `trackColor`): a palette name, `ink`, `blue`, `purple`, `green`, `pink`, `orange`, `red` or `grey`, which follows light and dark mode. Use a CSS colour only when the user names one. `colors` is a list of them, one per series.
- `palette`: colours from paper (tone 0) to ink (tone 1), for example `["--dither-paper", "blue"]`.
- `matrix`: `bayer4` (default for most), `bayer2`, `bayer8`, or `blue-noise` for an organic, less gridded look.
- `cell`: dot size in pixels, usually 3. Larger reads more retro.
- `fill`: `gradient`, `dotted`, `hatched` or `solid`.
- `bloom`: `off`, `low` or `high` glow.
- `animate`: `false` for a still frame. `speed` multiplies motion speed (default 1); keep it slow.
- `fps`, `stillTime`, `levels`, `colorField`: engine tuning. Leave them out unless asked.
- `axes`, `tooltip`, `legend`, `interactive`: booleans that switch chart parts on and off.
- `format`: `Intl.NumberFormat` options, for example `{"style": "currency", "currency": "EUR"}`.
- `className`: common Tailwind utilities only (spacing, `h-*`, `w-*`, `max-w-*`, text size and weight, `rounded-*`). Use it for text size, for example `"text-6xl font-bold"`.

## Data shapes

- Positions (`position`, `center`, `origin`, `source` and similar points): `[x, y]`, both 0 to 1, from the top left.
- `LatLon`: `[latitude, longitude]`.
- `ChartSeries`: `{"label", "value": "<row key>", "color"?}`. `LineSeries` adds `"dashed"?: true` and `"range"?: {"low": "<row key>", "high": "<row key>"}`.
- `DonutSlice`, `ProgressPart`: `{"label", "value", "color"?, "fill"?}`.
- `RadarSeries`: `{"label", "values": [one number per axis], "color"?, "fill"?}`.
- `HeatmapDatum`: `{"date": "YYYY-MM-DD", "value"}`. In matrix mode `data` is rows of numbers, with `rows` and `columns` labels.
- `UptimeDay`: `{"date": "YYYY-MM-DD", "uptime": 0 to 1 or null, "status"?: "up" | "degraded" | "down" | "none", "note"?}`.
- `GlobeMarker`, `DotMapMarker`: `{"at": LatLon, "label"?, "color"?}`. `GlobeArc`, `DotMapArc`: `{"from": LatLon, "to": LatLon, "color"?}`. `DotMapBounds`: `{"north", "south", "west", "east"}`.
- `MarqueeLogo`: `{"src", "alt", "ratio"?, "href"?}`.
- Image `src`: a URL the page can load. A `data:` URL always works; a remote image must allow cross-origin use.

## Components

## Backgrounds

- **dither-gradient**. Optional: `mode` (linear | radial | conic), `angle` (number), `center` (GradientPoint), `radius` (number), `from` (number), `to` (number), `noise` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **dither-glow**. Optional: `position`, `radius` (number), `intensity` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **mesh-gradient**. Optional: `blobs` (4 | 3 | 5), `size` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **aurora**. Optional: `curtains` (number), `height` (number), `spread` (number), `sway` (number), `turbulence` (number), `rays` (number), `length` (number), `glow` (number), `intensity` (number), `shimmer` (number), `scale` (number), `tilt` (number), `drift` (number), `direction` (up | down), `mask` (none | top | bottom | edges). Shared: animate, color, matrix, cell, colorField, levels, palette, speed, fps, stillTime, tipColor, background.
- **noise-field**. Optional: `variant` (smoke | ridges | contours | marble), `scale` (number), `warp` (number), `detail` (number), `contrast` (number), `coverage` (number), `intensity` (number), `bands` (number), `angle` (number), `flow` (number), `invert` (boolean), `mask` (center | none | top | bottom | edges), `maskSize` (number). Shared: animate, color, matrix, cell, colorField, levels, palette, speed, fps, stillTime, highlight, background.
- **waves**. Optional: `variant` (ocean | lines), `horizon` (number), `layers` (number), `amplitude` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **plasma**. Optional: `scale` (number), `warp` (number), `bands` (number), `intensity` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **beams**. Optional: `origin` (BeamsOrigin), `angle` (number), `spread` (number), `rays` (number), `sweep` (number), `reach` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **silk**. Optional: `folds` (number), `angle` (number), `sheen` (number), `intensity` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **smoke**. Optional: `scale` (number), `height` (number), `wind` (number), `density` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **contours**. Optional: `lines` (number), `scale` (number), `index` (number), `relief` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **ripples**. Optional: `sources` (RipplesSource[]), `rings` (number), `decay` (number), `intensity` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **ridgelines**. Optional: `lines` (number), `amplitude` (number), `spread` (number), `shade` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **metaballs**. Optional: `variant` (solid | rings), `count` (number), `size` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **tunnel**. Optional: `shape` (circle | square), `rings` (number), `spokes` (number), `center` (TunnelCenter), `sway` (number), `fog` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **retro-grid**. Optional: `horizon` (number), `sun` (number), `columns` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **eclipse**. Optional: `center` (EclipsePoint), `size` (number), `corona` (number), `light` (number), `pulse` (number), `rimColor` (colour), `skyColor` (colour). Shared: animate, matrix, cell, colorField, levels, speed, fps, stillTime.
- **horizon**. Optional: `horizon` (number), `curve` (number), `glow` (number), `aurora` (number), `stars` (number), `glowColor` (colour), `skyColor` (colour). Shared: animate, matrix, cell, colorField, levels, speed, fps, stillTime.
- **starfield**. Optional: `density` (number), `twinkle` (number), `angle` (number), `drift` (number), `nebula` (number). Shared: animate, matrix, cell, colorField, levels, palette, speed, fps, stillTime.
- **halftone**. Optional: `source` (noise | radial | linear), `center` ( | HalftonePoint), `radius` ( | number), `direction` ( | number), `channels` ([DitherColor, DitherColor] | [DitherColor, DitherColor, DitherColor]), `size` (number), `angle` (number), `scale` (number), `intensity` (number), `drift` (number). Shared: animate, color, cell, colorField, speed, fps, stillTime, background.
- **dither-globe**. Optional: `draggable` (boolean), `markers` (GlobeMarker[]), `arcs` (GlobeArc[]), `start` (number), `tilt` (number), `light` (number), `ocean` (number), `atmosphere` (boolean). Shared: color, accent, speed, cell, matrix, animate.
- **dot-map**. Optional: `title` (string), `markers` (DotMapMarker[]), `arcs` (DotMapArc[]), `columns` (number), `shape` (square | round), `halo` (number), `ocean` (number), `bounds` (DotMapBounds). Shared: color, accent, animate.
- **dither-orb**. Optional: `size` (number), `morph` (number), `lean` (number), `glow` (number). Shared: animate, color, matrix, cell, colorField, levels, speed, fps, stillTime, highlight, background.
- **dither-fade**. Optional: `side` (top | bottom | left | right), `size` (string | number). Shared: color, matrix, cell, animate.

## Charts

- **area-chart**: needs `data` (rows), `x` (the row key for categories), `series` (ChartSeries[]). Optional: `stack` (none | stacked | percent), `height` (number), `level` (number), `curve` (smooth | linear). Shared: matrix, cell, axes, tooltip, legend, format, fill, bloom, colors, interactive, animate.
- **bar-chart**: needs `data` (rows), `x` (the row key for categories), `series` (ChartSeries[]). Optional: `layout` (stacked | percent | grouped), `height` (number), `level` (number). Shared: highlight, matrix, cell, axes, tooltip, legend, format, fill, bloom, colors, interactive, animate.
- **line-chart**: needs `data` (rows), `x` (the row key for categories), `series` (LineSeries[]). Optional: `markers` (none | last | all), `zero` (boolean), `height` (number), `curve` (smooth | linear), `level` (number). Shared: matrix, cell, axes, tooltip, legend, format, fill, bloom, colors, interactive, animate.
- **sparkline**: needs `data` (number[]), `label` (string). Optional: `height` (number), `area` (boolean), `dot` (boolean), `level` (number), `domain` ([number, number]). Shared: color, fill, bloom, interactive, animate, matrix, cell, format.
- **heatmap**: needs `data` (HeatmapDatum[] | (number[])[]). Optional: `mode` (calendar | matrix), `weeks` (number), `weekStart` (0 | 1), `rows` (string[]), `columns` (string[]), `steps` (number), `max` (number), `unit` (string | { one: string; other: string; }). Shared: color, bloom, cell, legend, interactive, animate.
- **donut-chart**: needs `data` (DonutSlice[]), `label` (string). Optional: `mode` (donut | pie), `size` (number), `thickness` (number), `gap` (number), `unit` (string). Shared: fill, bloom, colors, format, legend, interactive, animate, matrix, cell.
- **radar-chart**: needs `axes`, `series` (NonEmpty<RadarSeries>). Optional: `max` (number), `rings` (number), `grid` (circle | polygon), `size` (number). Shared: fill, bloom, colors, format, legend, interactive, animate, matrix, cell.
- **gauge**: needs `value` (number), `label` (string). Optional: `min` (number), `max` (number), `variant` (ring | half | dial), `size` (number), `segments` (number), `unit` (string), `showRange` (boolean). Shared: color, format, trackColor, fill, bloom, animate, matrix, cell.
- **progress-bar**: needs `label` (string). Optional: `value` (null | number), `parts` (ProgressPart[]), `unit` (string), `max` (number), `valueText` (string), `hideLabel` (boolean), `size` (sm | md | lg), `segments` (number). Shared: color, fill, bloom, animate, cell.
- **uptime-bar**: needs `label` (string), `days` (UptimeDay[]). Shared: colors, fill, bloom, locale, matrix, cell.
- **stat-card**: needs `label` (string), `value` (string | number). Optional: `delta` (number), `deltaLabel` (string), `good` (up | down), `trend` (number[]). Shared: color, fill, bloom, matrix, cell.

## Interface

- **dither-button**. Optional: `variant` (filled | outline), `size` (sm | md | lg | icon), `loading` (boolean), `children` (text). Shared: fill, color, bloom, cell.
- **avatar**: needs `name` (string). Optional: `label` (string), `size` (number), `shape` (circle | square), `ring` (boolean), `status` (online | away | busy | offline). Shared: color, fill, bloom.
- **dither-card**. Optional: `children` (text), `glow` (top | bottom | top-left | top-right | bottom-left | bottom-right), `reach` (number), `strength` (number), `rim` (boolean), `radius` (number). Shared: interactive, color, fill, matrix, cell.
- **divider**. Optional: `orientation` (horizontal | vertical), `label` (text), `thickness` (number), `fade` (number), `strength` (number), `decorative` (boolean). Shared: color, fill, matrix, cell.
- **skeleton**. Optional: `shape` (block | text | circle), `lines` (number), `size` ( | number), `animation` (none | sweep | pulse), `duration` (number), `delay` (number). Shared: color, fill, cell.
- **loader**. Optional: `variant` (ring | pulse | dots | bar), `size` (sm | md | lg), `label` (string). Shared: color, bloom, matrix, cell, speed.
- **empty-state**: needs `title` (text). Optional: `children` (text), `description` (text), `action` (text), `illustration` (search | box | folder | planet), `titleAs` (h2 | h3 | h4). Shared: color, matrix, animate.
- **not-found**. Optional: `children` (text), `code` (string), `title` (text), `description` (text), `detail` (text), `actions` (text), `titleAs` (h1 | h2), `depth` (number). Shared: color, fill, bloom, cell, animate.

## Text

- **dither-text**: needs `children` (text). Optional: `scale` (number), `as` (div | h1 | h2 | h3 | h4 | p | span | strong), `direction` (number | up | down | left | right), `from` (number), `to` (number), `ghost` (number). Shared: fill, color, bloom, palette, matrix, cell, animate, speed.
- **dissolve-text**: needs `children` (string). Optional: `as` (div | h1 | h2 | h3 | h4 | p | span), `by` (line | char | word), `direction` (center | edges | start | end | random), `trigger` (mount | in-view), `show` (boolean), `level` (number), `duration` (number), `stagger` (number), `delay` (number). Shared: color, accent, fill, speed, matrix, cell.
- **scramble-text**: needs `children` (string). Optional: `as` (div | h1 | h2 | h3 | h4 | p | span), `trigger` (mount | in-view | hover | change), `mode` (dither | blocks | glyphs), `characters` (string), `duration` (number), `stagger` (number), `delay` (number), `rate` (number), `caret` (none | running | always). Shared: color, speed, cell.
- **dither-number**: needs `value` (number). Optional: `from` (number), `prefix` (string), `suffix` (string), `affixClassName` (string), `effect` (roll | resolve), `trigger` (mount | in-view), `size` (sm | md | lg | xl | display), `duration` (number), `stagger` (number). Shared: format, locales, color, accent, matrix, cell.

## Images

- **dither-image**: needs `src` (string), `alt` (string). Optional: `preset` (ink | duotone | newsprint | gameboy | riso), `method`, `contrast` (number), `brightness` (number), `invert` (boolean), `normalize` (boolean), `sharpen` (number), `fit` (cover | contain), `ratio` (number), `resolve` (boolean). Shared: color, palette, cell.
- **image-compare**: needs `src` (string), `alt` (string). Optional: `before` ({ kind: original; } | { kind: dither; } & Omit<DitherLook, fit>), `after` ({ kind: original; } | { kind: dither; } & Omit<DitherLook, fit>), `beforeLabel` (string), `afterLabel` (string), `labels` (boolean), `value` (number), `defaultValue` (number), `hint` (boolean), `ratio` (number), `fit` (cover | contain).
- **scroll-reveal-image**: needs `src` (string), `alt` (string). Optional: `preset` (ink | duotone | newsprint | gameboy | riso), `method`, `contrast` (number), `brightness` (number), `invert` (boolean), `normalize` (boolean), `sharpen` (number), `fit` (cover | contain), `end` (dither | photo), `coarsest` (number), `start` (number), `finish` (number), `scrollRoot` (RefObject<HTMLElement | null>), `progress` (number), `ratio` (number). Shared: color, palette, cell.
- **dithered-logo**: needs `src` (string), `alt` (string). Optional: `tone` (mono | original), `source` (alpha | dark), `outline` (boolean), `floor` (number), `effect` (none | shimmer | scan), `period` (number), `phase` (number), `ratio` (number), `lazy` (boolean). Shared: color, fill, matrix, cell.
- **logo-marquee**: needs `logos` (MarqueeLogo[]). Optional: `variant` (marquee | wall), `direction` (left | right), `fade` (none | dither | soft), `fadeWidth` (number), `pauseButton` (boolean), `outline` (boolean), `effect` (none | shimmer | scan), `tone` (mono | original), `floor` (number), `period` (number), `label` (string), `logoHeight` (number), `gap` (number). Shared: color, speed, fill, matrix, cell.

- **shader**: needs `field`: GLSL defining `float field(vec2 uv, vec2 res, float t)` that returns a smooth tone from 0 (paper) to 1 (ink); the engine does the dithering. `uv` runs 0 to 1 with y up, `res` is the size in cells, `t` is seconds. Multiply `uv.x` by `res.x / res.y` before measuring distances. Helpers: `hash21(p)`, `snoise(p)` in -1 to 1, `fbm(p)` in 0 to 1. Optional: `palette`, plus the shared props.

## Examples

Aurora hero:
```json
{"component":"aurora","props":{"color":"green"}}
```

Bar chart, two series:
```json
{"component":"bar-chart","title":"Revenue vs cost","props":{"x":"month","series":[{"label":"Revenue","value":"revenue","color":"blue"},{"label":"Cost","value":"cost","color":"orange"}],"data":[{"month":"Jan","revenue":120,"cost":80},{"month":"Feb","revenue":150,"cost":90}]}}
```

Gauge:
```json
{"component":"gauge","props":{"value":72,"label":"CPU","unit":"%"}}
```

Uptime:
```json
{"component":"uptime-bar","props":{"label":"API","days":[{"date":"2026-10-01","uptime":1},{"date":"2026-10-02","uptime":0.993,"status":"degraded"},{"date":"2026-10-03","uptime":0.87,"status":"down","note":"Database outage"}]}}
```

Globe with markers:
```json
{"component":"dither-globe","props":{"markers":[{"at":[40.7,-74]},{"at":[51.5,-0.1]}],"arcs":[{"from":[40.7,-74],"to":[51.5,-0.1]}]}}
```

Headline:
```json
{"component":"dither-text","props":{"children":"Dithered","fill":"gradient","color":"purple","className":"text-6xl font-bold"}}
```

Custom field, a pulsing circle:
```json
{"component":"shader","props":{"field":"float field(vec2 uv, vec2 res, float t) { vec2 p = vec2(uv.x * res.x / res.y, uv.y); float d = length(p - vec2(0.5 * res.x / res.y, 0.5)); return smoothstep(0.45, 0.1, d) * (0.85 + 0.15 * sin(t * 2.0)); }","palette":["--dither-paper","orange"]}}
```
