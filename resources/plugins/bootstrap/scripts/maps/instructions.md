# maps

Use when the user asks to see a place, route stops or locations on a map. Obtain coordinates from reliable sources; do not guess them.

Input fields:

- `latitude`, `longitude`: required. The map center in degrees.
- `zoom`: optional integer 0–19, default 13. Use about 4 for a country, 11 for a city, 15 for a street.
- `title`: optional heading. Omit it unless the user wants one.
- `markers`: optional, up to 100 `{ "latitude", "longitude", "label"? }`. The label shows when the marker is clicked.

Example:

```json
{"latitude":48.8584,"longitude":2.2945,"zoom":14,"markers":[{"latitude":48.8584,"longitude":2.2945,"label":"Eiffel Tower"}]}
```
