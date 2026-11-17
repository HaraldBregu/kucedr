import { getSidebarTranslucency, setSidebarTranslucency } from '../../../../src/main/settings_store';

it('disables sidebar translucency by default', () => {
	expect(getSidebarTranslucency()).toBe(false);
});

it('stores the sidebar translucency preference', () => {
	setSidebarTranslucency(false);
	expect(getSidebarTranslucency()).toBe(false);
	setSidebarTranslucency(true);
	expect(getSidebarTranslucency()).toBe(true);
});

it.each([null, undefined, 0, 1, 'false', {}])('rejects invalid sidebar translucency: %p', (value) => {
	setSidebarTranslucency(false);
	expect(() => setSidebarTranslucency(value as boolean)).toThrow('Invalid sidebar translucency setting.');
	expect(getSidebarTranslucency()).toBe(false);
});
