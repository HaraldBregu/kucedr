import { snapshotMarkdown } from '../../../../../src/main/memory/snapshot';
import { snapshotSource } from '../../../../../src/main/memory/snapshot_source';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

it('round trips visible messages through robust Markdown blocks', () => {
	const user = '# Heading\n\n> quote\n<!-- /kucedr-message -->\n```ts\nconst value = 1;\n```';
	const markdown = snapshotMarkdown(SESSION_ID, [
		{ role: 'system', content: 'hidden system text' },
		{
			role: 'user',
			content: [
				{ type: 'text', text: user },
				{ type: 'text', text: 'hidden internal text', internal: true },
				{ type: 'image', data: 'ignored attachment' },
			],
		},
		{ role: 'assistant', content: 'Visible answer' },
	]);

	expect(markdown).toContain('> # Heading');
	expect(markdown).not.toContain('hidden system text');
	expect(markdown).not.toContain('hidden internal text');
	expect(markdown).not.toContain('ignored attachment');
	expect(snapshotSource(SESSION_ID, markdown).messages.map((message) => message.text)).toEqual([
		user,
		'Visible answer',
	]);
});
