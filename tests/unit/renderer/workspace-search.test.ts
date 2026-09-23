import { searchWorkspaceEntries } from '../../../resources/apps/workspace/src/lib/search';

describe('searchWorkspaceEntries', () => {
	it('finds nested files and folders by name', () => {
		const entries = [
			{
				name: 'Projects',
				path: 'Projects',
				type: 'directory' as const,
				children: [
					{ name: 'Launch.md', path: 'Projects/Launch.md', type: 'file' as const },
				],
			},
		];

		expect(searchWorkspaceEntries(entries, 'launch')).toEqual([
			{ name: 'Launch.md', path: 'Projects/Launch.md', type: 'file' },
		]);
		expect(searchWorkspaceEntries(entries, 'project')).toEqual([
			expect.objectContaining({ name: 'Projects', type: 'directory' }),
		]);
	});
});
