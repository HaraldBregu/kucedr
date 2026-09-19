import { snapshotMarkdown } from '../../../../../src/main/memory/snapshot';
import { snapshotSource } from '../../../../../src/main/memory/snapshot_source';
import { sessionMemoryPath } from '../../../../../src/main/memory/session_path';

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
	], new Date('2026-09-19T14:30:00.000Z'));

	expect(markdown).toContain('**Date:** 2026-09-19T14:30:00.000Z');
	expect(markdown).toContain('**User:**');
	expect(markdown).toContain('**Assistant:**');
	expect(markdown).not.toContain('kucedr-memory-session');
	expect(markdown).not.toContain('<!-- kucedr-message:');
	expect(markdown).toContain('> # Heading');
	expect(markdown).not.toContain('hidden system text');
	expect(markdown).not.toContain('hidden internal text');
	expect(markdown).not.toContain('ignored attachment');
	expect(snapshotSource(SESSION_ID, markdown).messages.map((message) => message.text)).toEqual([
		user,
		'Visible answer',
	]);
});

it('continues reading existing version one snapshots', () => {
	const markdown = `# Session ${SESSION_ID}\n\n<!-- kucedr-memory-session:v1 -->\n\n<!-- kucedr-message:user -->\n> Legacy message\n<!-- /kucedr-message -->\n`;
	expect(snapshotSource(SESSION_ID, markdown).messages[0].text).toBe('Legacy message');
});

it('rejects a session ID that could escape the memory folder', () => {
	expect(() => sessionMemoryPath('../MEMORY')).toThrow('valid memory session ID');
});
