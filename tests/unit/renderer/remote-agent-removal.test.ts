import { SETTINGS_NAVIGATION } from '../../../src/renderer/src/pages/settings/navigation';

it('lists Channels without a remote agent settings entry', () => {
	expect(SETTINGS_NAVIGATION.some(({ path }) => path === '/settings/channels')).toBe(true);
	expect(SETTINGS_NAVIGATION.some(({ path }) => path === '/settings/remote-agent')).toBe(false);
});
