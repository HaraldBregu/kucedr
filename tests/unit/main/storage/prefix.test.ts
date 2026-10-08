import { storagePrefix } from '../../../../src/main/storage/storage_prefix';

describe('storagePrefix', () => {
	it('uses only the folder name, without application, version or hash prefixes', () => {
		const first = storagePrefix('/data/first/project');
		const second = storagePrefix('/data/second/project');

		expect(first).toBe('project/');
		expect(second).toBe('project/');
	});
});
