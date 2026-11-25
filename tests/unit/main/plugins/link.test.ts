import { authLinks } from '../../../../src/main/cloud/links';
import { pluginLinkId, pluginLinks } from '../../../../src/main/plugins/plugins_link';

const id = (value: string): string | null => pluginLinkId(new URL(value));

describe('plugin links', () => {
	it('reads a valid plugin ID', () => {
		expect(id('kucedr://plugins/brave')).toBe('brave');
		expect(id('kucedr://plugins/black-forest-labs/')).toBe('black-forest-labs');
	});

	it('rejects malformed links', () => {
		for (const value of [
			'kucedr://plugins/',
			'kucedr://plugins/Brave',
			'kucedr://plugins/brave/extra',
			'kucedr://plugins/brave?install=1',
			'kucedr://plugins/brave#install',
			'kucedr://plugin/brave',
			'https://plugins/brave',
			'kucedr://auth/callback',
		])
			expect(id(value)).toBeNull();
	});

	it('queues plugin links until a listener subscribes, and leaves auth links alone', async () => {
		expect(pluginLinks.push('kucedr://auth/callback?code=1')).toBe(false);
		expect(authLinks.push('kucedr://plugins/brave')).toBe(false);
		expect(pluginLinks.pushArguments(['/Applications/Kucedr', 'kucedr://plugins/brave'])).toBe(
			true
		);
		expect(pluginLinks.pushArguments(['kucedr://plugins/Not Valid'])).toBe(false);

		const opened: string[] = [];
		const unsubscribe = pluginLinks.subscribe(async (url) => {
			opened.push(url);
		});
		await expect(pluginLinks.flush()).resolves.toBe(true);
		expect(opened).toEqual(['kucedr://plugins/brave']);
		unsubscribe();
	});
});
