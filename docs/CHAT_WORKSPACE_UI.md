# Chat Home categories + Workspace / Formatted-text UI

Paths are relative to `src/`.

## 1. Chat Home: categories

- **Data**: add an optional `category?: string` (the category id) to each session's info file, next to `pinned`.
  - Save it the same way `main/agent/session/session_pin_session.ts` saves the pin, using `atomicWriteFile`.
  - Read it back in `main/agent/session/session_list_sessions.ts`, where `pinned` is read.
- **Category list**: store an ordered `chatCategories: { id, name }[]` in `main/settings_store.ts` (electron-store). Keeping it there lets a category exist with no chats in it.
- **IPC**: add `setSessionCategory(sessionId, categoryId | null)` and calls to create, rename and delete a category.
  - Handlers go in `main/ipc/agent.ts`.
  - Expose them in `preload/agent.ts`, next to `pinSession`.
- **Sidebar** (`renderer/src/pages/home/Sidebar.tsx`):
  - Pinned stays exactly as it is today. A pinned chat shows under Pinned, whatever its category.
  - Sections appear in this order: Pinned, then one collapsible section per category, then Recent. Recent holds chats with no category.
  - Reuse the existing collapsible section helper (about L176) and `renderSession`.
  - **Category header**:
    - It can be renamed in place; reuse `renderer/src/pages/workspace/RenameInput.tsx`.
    - Its context menu has Rename and Delete. Deleting a category moves its chats back to Recent.
    - It has no hover styles.
  - **Chat row**: its context menu gets a "Move to category" submenu that lists the categories and a "New category…" item.
- **Drag-and-drop**: use native HTML5 drag-and-drop with a custom MIME type, `application/x-chat-session`. This follows the workspace tree's `application/x-workspace-path` pattern, so no new dependency is needed.
  - Dropping a chat on a category's header or list moves it into that category.
  - Dropping it on Recent clears its category.
- **Collapsed state**: save `collapsedCategories: string[]` in the settings store. Expanding or collapsing a section is then remembered when the app restarts.

## 2. Workspace page

- **Export** (formatted text and PDF):
  - Add `main/export.ts` with an IPC call that opens the native save dialog and writes the file.
  - Formatted text: export the `.md` source, or HTML rendered with `marked` (already installed).
  - PDF: load the rendered HTML into a hidden `BrowserWindow` and call Electron's built-in `webContents.printToPDF`. No new library is needed.
- **File search in the command menu**:
  - Extend `buildCommandItems` in `renderer/src/experience/CommandMenu.tsx` with workspace files from `window.agent.listWorkspaceFiles`.
  - Selecting a file goes to the workspace route with `?file=<path>`. This matches `selectFile` in `renderer/src/pages/workspace/Page.tsx`.
- **Sidebar header** (`renderer/src/pages/workspace/Sidebar.tsx`, L300–335): remove the hover styles from the Workspace button. Search and "+" keep theirs.
- **Width button**:
  - Put the horizontal width toggle (current width ↔ full width) in the workspace page's top-right actions (`renderer/src/pages/workspace/Actions.tsx`), and remove it from the footer.
  - Save the `wide` state to localStorage, the same way `SELECTED_FILE_KEY` is saved in `Page.tsx`.
  - Open question: the footer meant here may be the viewer's bottom bar, the text-size control near `Viewer.tsx` L271. Confirm before implementing.

## 3. Formatted text view

Styles live in `renderer/src/index.css` under `.workspace-markdown-preview`; the editor is `renderer/src/pages/workspace/MarkdownEditor.tsx`.

- **Paragraphs**: reduce `line-height` to about 1.6 (L611).
- **Links**: make them blue, the theme blue (`blue-600`, and `blue-400` in dark mode) (L615).
- **Tables**: reduce cell vertical padding to about 4px and tighten the row line height (L621–638).
- **Headings**: set `font-weight: 700` (L557–590).
- **Top-right buttons** (`renderer/src/pages/workspace/Actions.tsx`):
  - **Search**: when activated, the find input opens in place, at the search button's position. It reuses the find logic in `Search.ts`.
  - **Width toggle**: the same control as in §2 (current width ↔ full width).
  - **Dropdown** (shadcn `DropdownMenu`) with these items:
    - Copy: the markdown source, to the clipboard.
    - Copy as rich text: HTML, through `ClipboardItem`.
    - Export → Markdown / HTML / PDF, using the export IPC from §2.

## Verification

Drive the built app with Playwright `_electron` and an isolated profile, then check each of these:

- Create, rename and delete a category. Deleting it moves its chats to Recent.
- Drag a chat between categories and to Recent. Restart the app and confirm the chat is still where you left it.
- Collapse a category, restart, and confirm it is still collapsed.
- The command menu finds a workspace file and opens it.
- Export Markdown, HTML and PDF, then open each output.
- Check the CSS changes visually. In the workspace sidebar header, only Search and "+" react to hover.
