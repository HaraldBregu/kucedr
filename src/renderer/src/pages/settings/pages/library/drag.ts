import { useState, type DragEvent } from 'react';
import type { LibraryFile } from '../../../../../../shared/library_types';

export const LIBRARY_DRAG_TYPE = 'application/x-kucedr-library-items';

export function useLibraryDrag(
	file: LibraryFile,
	selectedPaths: ReadonlySet<string>,
	onMove: (paths: string[], folder: string) => void
): {
	readonly isDropTarget: boolean;
	readonly onDragStart: (event: DragEvent<HTMLElement>) => void;
	readonly onDragOver: (event: DragEvent<HTMLElement>) => void;
	readonly onDragLeave: (event: DragEvent<HTMLElement>) => void;
	readonly onDrop: (event: DragEvent<HTMLElement>) => void;
} {
	const [isDropTarget, setIsDropTarget] = useState(false);
	return {
		isDropTarget,
		onDragStart(event) {
			const paths = file.kind !== 'folder' && selectedPaths.has(file.relativePath)
				? [...selectedPaths]
				: [file.relativePath];
			event.dataTransfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify(paths));
			event.dataTransfer.effectAllowed = 'move';
		},
		onDragOver(event) {
			if (file.kind !== 'folder' || !event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
			event.preventDefault();
			event.stopPropagation();
			event.dataTransfer.dropEffect = 'move';
			setIsDropTarget(true);
		},
		onDragLeave(event) {
			if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
				setIsDropTarget(false);
			}
		},
		onDrop(event) {
			if (file.kind !== 'folder' || !event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
			event.preventDefault();
			event.stopPropagation();
			setIsDropTarget(false);
			try {
				const paths: unknown = JSON.parse(event.dataTransfer.getData(LIBRARY_DRAG_TYPE));
				if (Array.isArray(paths) && paths.length > 0 && paths.every((path) => typeof path === 'string')) {
					onMove(paths, file.relativePath);
				}
			} catch {
				return;
			}
		},
	};
}
