import { sortLibraryFiles, type LibrarySortKey } from '../../../src/renderer/src/pages/settings/pages/library/sort';
import type { LibraryFile } from '../../../src/shared/library_types';

it('keeps folders above files for every table sort and direction', () => {
	const entries: LibraryFile[] = [
		{ name: 'alpha.png', path: '/library/alpha.png', relativePath: 'alpha.png', size: 1, modifiedAt: '2026-01-01' },
		{ kind: 'folder', name: 'Zeta', path: '/library/Zeta', relativePath: 'Zeta', size: 0, modifiedAt: '2026-01-02' },
		{ name: 'beta.png', path: '/library/beta.png', relativePath: 'beta.png', size: 2, modifiedAt: '2026-01-03' },
		{ kind: 'folder', name: 'Projects', path: '/library/Projects', relativePath: 'Projects', size: 0, modifiedAt: '2026-01-04' },
	];
	for (const key of ['name', 'size', 'modified'] as LibrarySortKey[]) {
		for (const direction of ['asc', 'desc'] as const) {
			expect(sortLibraryFiles(entries, { key, direction }).slice(0, 2).map((entry) => entry.kind)).toEqual(['folder', 'folder']);
		}
	}
});
