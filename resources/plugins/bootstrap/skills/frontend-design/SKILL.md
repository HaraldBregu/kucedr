---
name: frontend-design
description: Produces distinctive, well-crafted web UI. Decides the purpose and audience, commits to one visual direction, sets type, colour, and spacing tokens before any component, follows the project's existing design system when there is one, covers every state (hover, focus, disabled, empty, loading, error), responsive layout, contrast, and keyboard access, and checks the result in the browser. Use when the user asks to design or build a web page, landing page, dashboard, component, form, or app screen, or to restyle or improve the look of existing frontend code.
license: MIT
---

# Frontend design

Build interfaces that look intended: one clear direction, consistent tokens, every state handled, and verified in a browser. Decide before you write markup.

## Step 1: Check for an existing design system

Look before you invent. With `read` and `bash`, check:

- `package.json` for a UI library or styling framework.
- A theme or token file: CSS custom properties in a global stylesheet, a framework theme configuration, a `tokens` or `theme` file.
- Two or three existing screens or components, to see the spacing, radius, and type in real use.

If the project has a design system, it wins. Use its components, tokens, variants, and spacing scale. Do not add a new colour, font, radius, or a hand-built component that the library already provides. Skip Step 3 and Step 4, and apply the remaining steps within the system. Add something custom only when the system cannot do what is needed, and say so.

## Step 2: Decide purpose and audience

Answer these in one or two lines each. Infer what you can from the request; ask with `ask` only if a wrong guess would waste the work.

- Who uses this, and on what device and in what setting?
- What is the one thing they come here to do? That action gets the strongest visual weight.
- What should it feel like to them: calm, fast, precise, playful, serious?
- What content is real? Use the user's actual text, labels, and data shapes. Avoid placeholder filler; realistic content exposes layout problems.

## Step 3: Commit to one visual direction

Pick one direction and name it in a sentence, for example "dense and technical, monochrome with a single signal colour" or "editorial, large serif headings, generous whitespace". Tell the user the direction before building.

Make it specific by choosing:

- One dominant trait: the typography, the colour, the layout grid, or the density. The other aspects stay quiet to support it.
- A shape language: sharp, slightly rounded, or soft. Use it everywhere.
- A depth approach: flat with borders, or layered with shadows. Not both at random.

Avoid the default look that results from not deciding: a centred card on a pale gradient, a purple-to-blue accent, the same rounded corners and soft shadow on everything, three identical feature boxes with an icon each. If the result could belong to any product, the direction is not specific enough.

## Step 4: Set tokens first

Define tokens as CSS custom properties (or in the framework's theme) before writing any component. Components then use tokens only, never raw values.

- **Type**: at most two families, one for headings and one for text, or one family used well. A scale of 5 to 7 sizes with a consistent ratio. Body text at 16px or larger with line height 1.5 to 1.7; headings tighter, 1.1 to 1.3. Limit text lines to about 60 to 75 characters. Use a font already in the project or a system font stack unless the user agrees to load one.
- **Colour**: a neutral ramp of 8 to 10 steps for backgrounds, borders, and text; one accent with hover and active shades; semantic colours for success, warning, and error. Name tokens by role (`--color-surface`, `--color-text-muted`, `--color-accent`), not by hue. If dark mode is wanted, define both sets under the same role names.
- **Spacing**: one scale on a 4px base (4, 8, 12, 16, 24, 32, 48, 64). Every margin, padding, and gap comes from it.
- **Other**: 2 or 3 radius values, 2 or 3 shadow levels, one border colour, and transition durations of 120 to 250ms.

## Step 5: Build layout, then components

1. Start with the page structure in semantic HTML: `header`, `nav`, `main`, `section`, `footer`, headings in order without skipping levels, `button` for actions and `a` for navigation.
2. Lay out with CSS grid and flexbox, and use `gap` for spacing between siblings.
3. Establish hierarchy with size, weight, and space before colour. One primary action per view; secondary actions look secondary.
4. Group related items by placing them closer together than unrelated ones. Align to a small number of vertical edges.
5. Build components from the tokens. Match the project's file layout and naming conventions.

## Step 6: Cover every state

A component is not done until each state that applies has been designed:

| State | Requirement |
|---|---|
| Hover | A visible change on anything clickable; pointer cursor on non-native controls |
| Focus | A clear `:focus-visible` outline with at least 3:1 contrast against its background; never remove the outline without a replacement |
| Active / pressed | Immediate feedback |
| Disabled | Visibly inactive and not focusable; say why if the reason is not obvious |
| Loading | A skeleton or spinner where content will appear; submit buttons show progress and block a second submit |
| Empty | Say what belongs here and give the action that fills it |
| Error | Placed next to the cause, in plain words, with the way to recover; never by colour alone |
| Success | Confirm that the action worked |
| Long or missing content | Long names, large numbers, missing images, and translated text must not break the layout |

## Step 7: Responsive layout and access

- Write the narrow layout first and add breakpoints with `min-width` where the content needs them. Nothing may cause horizontal scrolling at 320px wide.
- Use relative units (`rem`, `%`, `fr`, `clamp()`) for sizes; give images and media `max-width: 100%`.
- Touch targets are at least 44 by 44px.
- Contrast: 4.5:1 for body text, 3:1 for large text, icons, and control borders. Compute the ratio for each text and background token pair; do not judge by eye.
- Keyboard: every interactive element is reachable with Tab in a logical order and operable with Enter or Space. Dialogs trap focus, close on Escape, and return focus to the control that opened them.
- Every input has a visible `label`. Images have `alt` text, empty for decorative ones. Icon-only buttons have an `aria-label`.
- Honour `prefers-reduced-motion` by removing non-essential animation.

## Step 8: Check it in the browser

Do not hand over UI you have not looked at.

1. Serve the page: start the project's dev server with `bash` and `background: true`, keep the `sessionId`, and wait for the ready line with `process` (`action: "poll"`). A project with a dev server needs it; do not open built files directly.
2. Open the URL with `use_web_browser` (`action: "open"`) and take a `snapshot`. Confirm the text, headings, and controls you built are present and in the intended order.
3. `screenshot` returns only a file path, and `read` handles text files, so you cannot view the image. Take one with `fullPage: true` for the user, give them the path, and ask them to judge the look. Measure what you can with `act`, `kind: "evaluate"`: for example `getComputedStyle(document.querySelector('h1')).fontSize`, or `[...document.querySelectorAll('.card')].map(e => e.getBoundingClientRect().left)` to confirm elements share an edge.
4. Exercise the states: `act` with `kind: "hover"`, `click`, and `type` on real controls using refs from the snapshot, then snapshot again to confirm the error, empty, and loading states show the right text. Screenshot each for the user.
5. Keyboard pass: `act` with `kind: "press"` and `key: "Tab"` several times; after each, check focus with `kind: "evaluate"` and `fn: "document.activeElement?.outerHTML.slice(0, 120)"`. Confirm the focus style applies with `getComputedStyle(document.activeElement).outlineStyle`.
6. Overflow check with `evaluate`: `document.documentElement.scrollWidth > document.documentElement.clientWidth` must be `false`.
7. Read `action: "console"` and fix any errors.
8. The browser tool cannot resize the window or emulate a device. State that narrow widths were verified from the CSS only, and ask the user to resize if that matters.
9. Close the tab (`action: "close"`) and stop the server with `process` (`action: "kill"`) if you started it.

Fix what the checks show and repeat until they pass. If the browser is unavailable, say the result was not checked in a browser.

## Step 9: Report

```
Direction: [the one-sentence direction, or "followed the existing design system: <name>"]
Files: [paths created or changed]
Tokens: [where they are defined]
States covered: [list]
Checked in browser: [what you verified, with screenshot paths]
Not verified: [visual appearance (screenshots are for you to judge), narrow viewports, dark mode, real data]
```
