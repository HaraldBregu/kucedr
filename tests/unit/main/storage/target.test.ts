import { storageTarget } from '../../../../src/main/storage/storage_target';

describe('storageTarget', () => {
	it('resolves an object key beneath the selected folder', async () => {
		await expect(
			storageTarget('/data/kucedr', 'kucedr/v1/agent/notes/today.md', 'kucedr/v1/agent/')
		).resolves.toBe('/data/kucedr/notes/today.md');
	});

	it.each([
		['another prefix', 'kucedr/v1/archive/notes.md'],
		['a parent traversal', 'kucedr/v1/agent/../notes.md'],
		['an empty path segment', 'kucedr/v1/agent/notes//today.md'],
	])('rejects %s', async (_name, key) => {
		await expect(storageTarget('/data/kucedr', key, 'kucedr/v1/agent/')).rejects.toThrow(
			/[Ss]torage object/
		);
	});
});
