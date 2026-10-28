# chart

Use when the user asks for a chart, graph or plot, or when numbers read better visually than as text:

- **line** or **area**: a trend over time (months, quarters, years).
- **bar** or **horizontal-bar**: a comparison across categories; use horizontal bars for longer labels.
- **stacked-bar** or **stacked-area**: contributions from multiple series to a total.
- **pie** or **doughnut**: shares of a whole (a few slices that add up to 100%).
- **scatter**: a relationship between numeric x and y values.
- **radar**: compare series across several metrics on radial axes.

Do not use it for a single number or for data that is mostly text.

Input fields:

- `type`: required. One of `bar`, `horizontal-bar`, `stacked-bar`, `line`, `area`, `stacked-area`, `pie`, `doughnut`, `scatter`, or `radar`.
- `title`: optional. Omit it for an untitled chart. Never invent a heading when the user requests no title. Empty titles also produce no heading.
- `description`: optional text below the heading.
- `data`: required, 1–200 objects, one per x-axis point or per slice for pie and doughnut.
- `xKey`: required. The field in each row that holds the category or label, for example `"month"`. For scatter, every value in this field must be a finite number.
- `series`: required, 1–6 objects with a non-empty `key` naming a numeric field and a non-empty human-readable `label`. Every row needs a finite number for every series key. Pie and doughnut use only the first series.

Examples:

Bar, one series:
```json
{"type":"bar","title":"Monthly sales","xKey":"month","series":[{"key":"sales","label":"Sales"}],"data":[{"month":"Jan","sales":10},{"month":"Feb","sales":20},{"month":"Mar","sales":15}]}
```

Line, two series:
```json
{"type":"line","title":"Revenue vs cost","xKey":"quarter","series":[{"key":"revenue","label":"Revenue"},{"key":"cost","label":"Cost"}],"data":[{"quarter":"Q1","revenue":120,"cost":80},{"quarter":"Q2","revenue":150,"cost":90},{"quarter":"Q3","revenue":170,"cost":95}]}
```

Pie:
```json
{"type":"pie","title":"Market share","xKey":"vendor","series":[{"key":"share","label":"Share %"}],"data":[{"vendor":"A","share":45},{"vendor":"B","share":30},{"vendor":"C","share":25}]}
```

Untitled horizontal bar:
```json
{"type":"horizontal-bar","xKey":"product","series":[{"key":"sales","label":"Sales"}],"data":[{"product":"Product A","sales":10},{"product":"Product B","sales":20}]}
```

Stacked bars (use `"stacked-area"` for the same contributions over time):
```json
{"type":"stacked-bar","xKey":"quarter","series":[{"key":"online","label":"Online"},{"key":"store","label":"Store"}],"data":[{"quarter":"Q1","online":60,"store":40},{"quarter":"Q2","online":80,"store":50}]}
```

Scatter:
```json
{"type":"scatter","xKey":"hours","series":[{"key":"score","label":"Score"}],"data":[{"hours":1,"score":40},{"hours":3,"score":70},{"hours":5,"score":90}]}
```

Radar:
```json
{"type":"radar","xKey":"metric","series":[{"key":"a","label":"Team A"},{"key":"b","label":"Team B"}],"data":[{"metric":"Speed","a":70,"b":90},{"metric":"Quality","a":90,"b":70},{"metric":"Cost","a":60,"b":80}]}
```
