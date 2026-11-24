# 4. Accessibility

Part of the [Roadmap](README.md). Status: 4.1–4.4 built 2026-11-24; 4.5 open.

## Built 2026-11-24

- **4.1** The chat log no longer announces each streamed chunk (`aria-live="off"`). One status
  line (`src/renderer/src/pages/home/Announcer.tsx`) reads "Kucedr is responding", the running
  tool's label, then "Reply complete", "Reply stopped" or "Reply failed" with the error. Tool-step
  announcements use the same running check as the tool card; not seen live, because the mock
  tool finished too fast.
- **4.2** A "Skip to content" button is the first tab stop on every split page and moves focus
  to the page body. Chat rows and category headers open their menu with Shift+F10 or the Menu
  key, and F2 renames a category. Moving chats between categories already works from the
  focusable "More" button.
- **4.3** No text under 12px is left in the renderer. The light focus ring is darker. A system
  high-contrast setting (`nativeTheme.shouldUseHighContrastColors`, macOS and Windows) darkens
  muted text, borders and rings, and forced-colours mode keeps a visible focus outline. The
  bootstrap plugin adds a "High Contrast" theme in Settings › General.
- **4.4** A scan of icon-only buttons found none without a name.
- **4.5** is blocked: `npm run lint` crashes today (`eslint-plugin-react` against ESLint 10), and
  `eslint-plugin-jsx-a11y` does not yet support ESLint 10.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 4.1 | Screen-reader chat | One announcement when a reply completes or fails, tool activity read as steps, no token-by-token noise | The chat is a live log (`src/renderer/src/components/ui/chat-container.tsx`), so every chunk is announced; tool activity has no labels | M |
| 4.2 | Full keyboard use | Every action reachable without a mouse, including moving chats between categories; a skip link | The command menu exists; drag-and-drop has no keyboard path _(not verified end to end)_ | M |
| 4.3 | High contrast and text size | A high-contrast theme, support for the system's high-contrast setting, and no text under 12px | Zoom and reduced-motion support exist; about 66 places use 9–11px text; the focus ring looks under the 3:1 minimum _(from colour values, not measured)_ | M |
| 4.4 | Named controls | Every button and control has a spoken name | About 16 icon buttons have none, starting with onboarding and cloud settings | S |
| 4.5 | Accessibility checks | New screens are checked automatically for the problems above | No accessibility lint or test today; needs two development dependencies | S |

## Open decisions

- **4.5 adds development dependencies and a test.** It is the cheapest safeguard, but it needs an
  explicit go.
- **The browser pane (3.9).** It is planned as a real web view, so a screen reader can read the
  page inside it. Its toolbar and tabs need names and keyboard access like any other control; see
  the [Embedded agent browser plan](../AGENT_BROWSER_PLAN.md).
