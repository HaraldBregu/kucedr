import { SETTINGS_NAVIGATION } from '../../../src/renderer/src/pages/settings/navigation';

it('does not list channels or remote agent settings' , () => {
	expect(SETTINGS_NAVIGATION.some(({ path }) => path === '/settings/channels')).toBe(false);
	expect(SETTINGS_NAVIGATION.some(({ path }) => path === '/settings/remote-agent')).toBe(false);
});
