import { normalizeStorageSettings } from '../../../../src/main/backup/normalize';

const settings = { paths: [], syncEnabled: false, syncCronExpression: '0 3 * * *' };

it('preserves the selected storage service', () => {
	expect(normalizeStorageSettings({ ...settings, serviceId: ' s3/storage ' })).toEqual({
		...settings,
		serviceId: 's3/storage',
	});
});

it.each([undefined, '', '   ', null, 42])('omits empty service selection %p', (serviceId) => {
	expect(normalizeStorageSettings({ ...settings, serviceId })).toEqual(settings);
});

it('drops the legacy provider selection', () => {
	expect(
		normalizeStorageSettings({ ...settings, providerId: 'a00c674a-c8c8-4d01-930f-ad690b3d0123' })
	).toEqual(settings);
});

it('rejects an invalid cron expression', () => {
	expect(() => normalizeStorageSettings({ ...settings, syncCronExpression: 'not a cron' })).toThrow(
		'cron'
	);
});
