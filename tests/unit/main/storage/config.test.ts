import { normalizeStorageSettings } from '../../../../src/main/storage/storage_config';

const settings = { paths: [], syncEnabled: false, syncCronExpression: '0 3 * * *' };
const providerId = 'a00c674a-c8c8-4d01-930f-ad690b3d0123';

it('preserves the selected storage provider', () => {
	expect(normalizeStorageSettings({ ...settings, providerId })).toEqual({ ...settings, providerId });
});

it.each([undefined, '', '   ', null])('omits empty provider selection %p', (providerId) => {
	expect(normalizeStorageSettings({ ...settings, providerId })).toEqual(settings);
});

it.each([42, {}, 'unknown', '../outside'])('rejects invalid provider selection %p', (providerId) => {
	expect(() => normalizeStorageSettings({ ...settings, providerId })).toThrow('identifier');
});
