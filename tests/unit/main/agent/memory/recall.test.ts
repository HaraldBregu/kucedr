import { recall } from '../../../../../src/main/memory/recall';

it('always recalls up to four unique core records plus relevant durable records', () => {
	const markdown = `# Memory
## Profile
- Lives in Rome.
- Builds Kucedr.
## Preferences
- Prefers concise answers.
- Uses dark mode.
- Fifth core record.
- Prefers concise answers.
## Projects
- Kucedr uses TypeScript.
- Unrelated Python project.
## Plans
- Plan the Kucedr release.
## Summaries
- Discussed Kucedr architecture.
`;
	const result = recall(markdown, 'Kucedr TypeScript release architecture');
	const lines = result.split('\n');
	expect(lines.slice(0, 4)).toEqual([
		'- Lives in Rome.',
		'- Builds Kucedr.',
		'- Prefers concise answers.',
		'- Uses dark mode.',
	]);
	expect(result).toContain('- Kucedr uses TypeScript.');
	expect(result).toContain('- Plan the Kucedr release.');
	expect(result).not.toContain('Unrelated Python');
	expect(new Set(lines).size).toBe(lines.length);
	expect(lines.length).toBeLessThanOrEqual(12);
	expect(result.length).toBeLessThanOrEqual(4000);
});

it('returns core records for an unrelated query and excludes headings and private records', () => {
	const result = recall(
		'# Memory\n## Profile\n- Prefers short replies.\n- Password is secret123.\n## Facts\n- Uses Rust.\n',
		'unrelated'
	);
	expect(result).toBe('- Prefers short replies.');
});
