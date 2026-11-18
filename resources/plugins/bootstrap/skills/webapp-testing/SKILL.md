---
name: webapp-testing
description: Tests a locally running web app by driving a real Chrome browser with use_web_browser. Starts the dev server in the background, waits until it responds, walks a user flow step by step, checks the browser console and failed requests, captures screenshots as evidence, reports pass or fail for each step, and stops the server afterwards. Use when the user asks to test, verify, smoke-test, or reproduce a bug in a web app or page on localhost, or to confirm that a frontend change works in the browser.
license: MIT
---

# Web app testing

Run the app, perform the flow the way a user would, and report what happened at each step with evidence. Report what you observed, not what the code suggests should happen.

## What the tools can and cannot do

- `bash` starts the server. `process` only manages a session that `bash` already started (`poll`, `log`, `kill`); it cannot start one.
- `use_web_browser` drives Google Chrome, which must be installed. In a normal chat the window is visible and `localhost` is allowed. In background or scheduled runs the browser is headless and blocks local and private addresses, so this skill does not work there; say so and stop.
- Element refs such as `e12` come from `snapshot` and are reassigned on every snapshot. Take a new snapshot after any navigation or change to the page before using a ref.
- `snapshot` lists visible interactive elements and the page text, cut at 4,000 characters unless you raise `maxChars`.
- `console` returns the latest messages for a tab (50 by default, 100 kept). There is no network inspection action; use the `evaluate` checks below.
- There is no action to resize the window or emulate a device.
- `screenshot` saves a PNG and returns its `path`. `pdf` is unavailable in a visible browser.
- Actions time out after 15 seconds unless you pass `timeoutMs`.

## Step 1: Plan the flow

Before starting anything, write the test as numbered steps, each with an action and an expected result:

```
1. Open /login -> the sign-in form is shown
2. Submit empty form -> a validation message appears, no navigation
3. Sign in with the test account -> redirected to /dashboard, user name visible
```

Take the steps from the user's request. If they did not say what to test, read the routes or the README, propose a short flow, and proceed. If the flow needs credentials or test data you do not have, ask with `ask` first. Do not test against a production URL or with real payment or account data unless the user tells you to.

## Step 2: Start the server

1. Find the start command and port: `read` `package.json` scripts, the README, or the framework configuration. Install dependencies only if they are missing, and tell the user.
2. Check whether the app is already running: `bash` with `curl -sS -o /dev/null -w "%{http_code}" http://localhost:<port>`. If it answers, use it and do not start or stop anything; note that the server was not yours.
3. Otherwise start it with `bash`, setting `background: true` and `workdir` to the project folder. Keep the returned `sessionId`.
4. Wait for readiness: call `process` with `action: "poll"`, the `sessionId`, and `timeout: 15000`. Read `stdout` and `stderr` for the "ready" or "listening" line and the actual URL; the port may differ from the one you expected. Poll again until it appears, for at most about 90 seconds in total.
5. If `exited` is true or the output shows an error, stop. Report the last lines of `stderr` as the result; do not go on to the browser.
6. Confirm with the `curl` command from point 2 that the URL responds.

## Step 3: Walk the flow

Open the app with `use_web_browser`, `action: "open"`, and the URL. Keep the returned `targetId` and pass it on later calls. Then, for each planned step:

1. `snapshot` to see the current page and get refs.
2. Perform the action with `action: "act"` and a `kind`:
   - `click` with `ref`.
   - `type` with `ref` and `text`; add `submit: true` to press Enter. `fill` with `fields: [{ref, value}]` for several inputs at once.
   - `select` with `ref` and `values`; `press` with `key` (for example `Tab`, `Escape`); `hover` with `ref`.
3. Wait for the result instead of guessing: `act` with `kind: "wait"` and a CSS `selector` that should appear, or `loadState: "networkidle"` after a navigation. Use a fixed `timeMs` only as a last resort.
4. `snapshot` again and compare the URL, title, text, and elements with the expected result.
5. Take a `screenshot` when a step fails, and at the key success points of the flow. Use `fullPage: true` for long pages or `ref` for one element.
6. Read `console` after each step that loads or changes the page.

If a step fails, record it and continue with the remaining steps where that still makes sense. If later steps depend on the failed one, mark them `blocked`, not `failed`.

## Step 4: Check console and requests

- Console: any `[error]` entry is a finding even when the page looks right. Report `[warning]` entries only when they relate to the flow. Quote the message text.
- Failed or slow requests: there is no network log, so read the browser's resource timings with `act`, `kind: "evaluate"`, and this `fn`:

```
performance.getEntriesByType('resource').map(e => ({ url: e.name, status: e.responseStatus, ms: Math.round(e.duration) })).filter(e => e.status >= 400 || e.ms > 2000)
```

  `responseStatus` can be 0 for cross-origin requests; treat 0 as unknown, not as a failure.
- A specific endpoint: check it directly with `evaluate`, for example `fetch('/api/items').then(r => r.status)`.
- State the page cannot show: read it with `evaluate` (for example `document.activeElement?.id`, `localStorage.getItem('token') !== null`, `document.querySelectorAll('.row').length`).
- Server side: `process` with `action: "log"` shows the server output. Include stack traces or 5xx lines that appeared during the flow.

Use `evaluate` to inspect, not to perform the user's actions; a click made by script does not prove the button works for a person.

## Step 5: Clean up

Do this even when the test failed or you stopped early:

1. Close the tab you opened: `use_web_browser` with `action: "close"` and its `targetId`. Leave other tabs alone.
2. If you started the server, stop it: `process` with `action: "kill"` and the `sessionId`, then `poll` once to confirm `exited` is true.
3. Do not stop a server that was already running when you began.
4. Remove any test data you created if the user asked for that; otherwise list it in the report.

## Step 6: Report

```
## Test: [flow name] at [URL]

Result: [n] passed, [n] failed, [n] blocked

| # | Step | Expected | Observed | Result |
|---|------|----------|----------|--------|
| 1 | Open /login | Sign-in form shown | Form shown | pass |
| 2 | Submit empty form | Validation message | Page reloaded, no message | fail |

### Failures
2. Submit empty form
   Observed: [what happened, with the exact text seen]
   Console: [error lines, or "none"]
   Requests: [failed requests with status, or "none"]
   Screenshot: [path]
   Likely cause: [only if you traced it in the code; otherwise omit]

### Console and server output
[Errors not tied to a single step, or "clean"]

### Not tested
[Steps skipped and why; note that other viewport sizes were not checked]

Server: [started and stopped by this test / already running, left as is]
```

Do not report a step as passed unless you observed its expected result in a snapshot, a screenshot, or an `evaluate` value. Do not fix the bugs you find unless the user asks.
