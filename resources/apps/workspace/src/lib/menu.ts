import { isKucedr, win, type ContextMenuDescriptor } from "@kucedr/sdk"

interface ContextMenuEvent {
  preventDefault: () => void
  stopPropagation: () => void
}

type ContextMenuActions = Record<string, () => void | Promise<void>>

export function showNativeContextMenu(
  event: ContextMenuEvent,
  items: ContextMenuDescriptor[],
  actions: ContextMenuActions = {},
) {
  if (!isKucedr()) return
  event.preventDefault()
  event.stopPropagation()
  void win
    .showContextMenu(items)
    .then((action) => (action ? actions[action]?.() : undefined))
    .catch(() => undefined)
}
