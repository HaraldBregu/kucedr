# 4. Accessibility

Part of the [Roadmap](README.md). Status: proposal.

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
- **The browser pane (3.9).** If it is built as a mirrored view, the page inside it is a picture
  and a screen reader cannot read it; see the
  [Embedded agent browser plan](../AGENT_BROWSER_PLAN.md).
