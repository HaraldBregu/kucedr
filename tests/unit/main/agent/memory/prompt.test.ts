import { promptMemory } from '../../../../../src/main/memory/prompt';

const durable = '# Memory\n## Preferences\n- Use dark mode.\n## Facts\n- Lives in Rome.';
const summaries = Array.from(
	{ length: 15 },
	(_, i) => `- Reviewed heliotrope project ${i}. ${'Prior discussion. '.repeat(19).trimEnd()}`
);
const memory = [durable, '## Summaries', ...summaries, '## Plans', '- Publish in May.'].join('\n');

it('keeps durable sections and omits unrelated summaries from the first request', () => {
	const prompt = promptMemory(memory, 'Hello, can you help me with this?');
	expect(prompt).toBe(durable + '\n## Plans\n- Publish in May.');
	expect(Buffer.byteLength(memory) - Buffer.byteLength(prompt)).toBeGreaterThan(5500);
});

it('recalls a bounded set of matching summary records for any request', () => {
	const prompt = promptMemory(memory, 'Where did we discuss heliotrope?');
	expect(prompt).toContain('## Summaries\n- Reviewed heliotrope project 0.');
	expect(prompt).toContain('- Publish in May.');
	expect(prompt.split('## Summaries\n')[1].length).toBeLessThanOrEqual(4000);
	expect(promptMemory(memory, 'helio')).not.toContain('heliotrope');
});

it('recognizes legacy tagged records and nested sections, and filters private summaries', () => {
	const memory =
		'# Memory\n- Decided on violet. <!-- kucedr:summary:work -->\n## Summaries\n### Last month\n- Selected indigo.\n  Keep this detail.\n- Indigo bank account info.\n## Plans\n- Finish in June.';
	expect(promptMemory(memory, 'violet indigo')).toBe(
		'# Memory\n## Plans\n- Finish in June.\n\n## Summaries\n- Decided on violet.\n- Selected indigo.\nKeep this detail.'
	);
	expect(promptMemory(memory, 'hello')).not.toMatch(/violet|indigo|Keep this detail|Last month/);
});
