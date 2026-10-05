import type { LibraryFile } from '../../../../../../shared/library_types';

export type LibrarySortKey = 'name' | 'size' | 'modified';
export type LibrarySort = { key: LibrarySortKey; direction: 'asc' | 'desc' };

export function sortLibraryFiles(files: LibraryFile[], sort: LibrarySort): LibraryFile[] {
	const direction = sort.direction === 'asc' ? 1 : -1;
	return [...files].sort((left, right) => {
		if (left.kind === 'folder' && right.kind !== 'folder') return -1;
		if (left.kind !== 'folder' && right.kind === 'folder') return 1;
		let comparison: number;
		switch (sort.key) {
			case 'name':
				comparison = left.name.localeCompare(right.name);
				break;
			case 'size':
				comparison = left.size - right.size;
				break;
			case 'modified':
				comparison = left.modifiedAt.localeCompare(right.modifiedAt);
				break;
		}
		return comparison === 0
			? left.relativePath.localeCompare(right.relativePath)
			: comparison * direction;
	});
}
