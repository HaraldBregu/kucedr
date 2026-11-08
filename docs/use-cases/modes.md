# Plan and goal use cases

These scenarios demo the bundled **Plan** (`/plan`) and **Goal** (`/goal`) modes on web tasks whose results render through [plugin scripts](../PLUGIN_SCRIPTS.md). Both modes ship in the bootstrap plugin (`resources/plugins/bootstrap/modes/`).

- **Plan** is read-only. It can use `search_web`, `fetch_web_page`, `load_script`, and `run_script`, but not `use_web_browser`, which is not read-only. It records its steps with `update_mode_state` and ends with one `<proposed_plan>` envelope and an **Implement** action.
- **Goal** can use every tool. It records its objective and success criteria with `update_mode_state`, marks each criterion done with evidence, and completes only when every criterion has evidence.

Setup for every scenario: the Bootstrap plugin is enabled, a search engine is selected under **Settings → Providers → Search engines**, and you start a new chat. Expand the tool activity: a script must appear as `load_script` followed by `run_script` with the named script, and render in a frame.

## Plan a sourced chart

1. Send: `/plan I want a bar chart comparing the GitHub star counts of <PROJECT_A>, <PROJECT_B> and <PROJECT_C>. Find the numbers on the web and show me a draft chart before we commit.`
2. Answer any `ask` questions, such as the time period or which projects to include.
3. Click **Implement**.

**Pass:** While planning, the tool activity shows `search_web` or `fetch_web_page`, then `load_script` and `run_script` with `name: "chart"`, and a draft chart renders. Nothing is written to disk. The final reply is one proposed plan whose steps name each source URL. After **Implement**, the run leaves Plan mode and renders the final chart with the same sourced values.

## Plan a map of places from the web

1. Send: `/plan Plan a walking tour of three museums in <CITY>. Look up their addresses on the web and preview them on a map.`

**Pass:** The tool activity shows a web lookup, then `run_script` with `name: "maps"` and one marker per museum. The marker labels match the sources. The plan's steps are recorded with `update_mode_state`, and the reply is one `<proposed_plan>` with no text outside it.

## Plan cannot drive a browser

1. Send: `/plan Open <PUBLIC_URL> in the browser, click <HARMLESS_CONTROL>, then plan a diagram of what changes.`

**Pass:** No `use_web_browser` call runs. The agent either uses `fetch_web_page` to inspect the page, or states in the plan that the interaction needs **Implement**. If it renders a draft, it uses `run_script` with `name: "draw"`.

## Reach a sourced chart goal

1. Send: `/goal Build a line chart of the last five stable release dates of <PUBLIC_PROJECT>, each taken from its official release page.`

**Pass:** The first `update_mode_state` call records the objective and checkable criteria, such as "five releases found", "each from the official page", and "chart rendered". The agent runs `search_web`/`fetch_web_page`, then `run_script` with `name: "chart"`, without asking you anything. Each criterion is marked done with evidence (a URL or tool result), the state ends as completed, and the reply lists every criterion with its evidence.

## Reach a map goal through the browser

1. Send: `/goal Use the web browser to open <PUBLIC_STORE_LOCATOR_URL>, read the first three locations, and show them on a map.`

**Pass:** Tool activity shows `use_web_browser` navigation and a snapshot, then `run_script` with `name: "maps"` and three labeled markers. Each criterion's evidence cites the snapshot. Close the browser tab afterward.

## Reach a diagram goal from a site's navigation

1. Send: `/goal Map the top-level navigation of <PUBLIC_URL> as a diagram, one box per menu item, with arrows from the home page.`

**Pass:** The agent inspects the page with `fetch_web_page` or a `use_web_browser` snapshot, then calls `run_script` with `name: "draw"`. The boxes match the menu items on the page. The goal completes with that evidence.

## Recover from a script error in a goal

1. Send: `/goal Fetch <PUBLIC_JSON_URL> and chart its numeric fields as a bar chart.`
2. If the first `run_script` call fails, for example because of a missing `xKey`, watch the next call.

**Pass:** The script's error message appears in the tool result. The agent corrects the input and calls `run_script` again without asking you, and the goal completes only after a chart renders. If the URL has no numeric fields, the state ends as blocked with a note instead of completed.
