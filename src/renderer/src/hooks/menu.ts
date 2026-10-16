import { useCallback, type MouseEvent } from 'react';
import type { ContextMenuDescriptor } from '../../../shared/window_types';

export function useContextMenu(
	items: ContextMenuDescriptor[] | (() => ContextMenuDescriptor[]),
	onSelect: (id: string) => void
): (event: MouseEvent) => void {
	return useCallback(
		(event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			const list = typeof items === 'function' ? items() : items;
			const hasSelection = Boolean(window.getSelection()?.toString().trim());
			const menu: ContextMenuDescriptor[] = hasSelection
				? [{ type: 'role', role: 'copy' }, ...(list.length ? [{ type: 'separator' } as const] : []), ...list]
				: list;
			if (!menu.length) return;
			void window.win.showContextMenu(menu).then((id) => {
				if (id) onSelect(id);
			});
		},
		[items, onSelect]
	);
}
