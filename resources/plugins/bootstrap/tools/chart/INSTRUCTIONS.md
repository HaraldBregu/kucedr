Use when the user asks for a chart, graph or plot, or when numbers read better visually than as text:

- **line** or **area**: a trend over time (months, quarters, years).
- **bar**: a comparison across categories.
- **pie** or **doughnut**: shares of a whole (a few slices that add up to 100%).

Do not use it for a single number or for data that is mostly text.

Input fields:

- `data`: one object per x-axis point, or per slice for pie and doughnut.
- `xKey`: the field in each row that holds the category or label, for example `"month"`.
- `series`: the numeric fields to plot, each with a human-readable `label`. Every row needs a number for every series key.

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
