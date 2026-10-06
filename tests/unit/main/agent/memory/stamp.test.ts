import { parseMemories } from '../../../../../src/main/memory/parse';
import { recall } from '../../../../../src/main/memory/recall';
import { stampMemories } from '../../../../../src/main/memory/stamp';

it('dates new records, preserves known dates, and leaves legacy dates unknown', () => {
	const original =
		'# Memory\n- Legacy fact.\n- Existing fact. <!-- kucedr:created:2026-10-01T10:00:00.000Z -->\n';
	const next =
		'# Memory\n- Legacy fact.\n- Existing fact.\n- New summary. <!-- kucedr:summary:work -->\n';
	const saved = stampMemories(next, original, new Date('2026-10-06T09:00:00.000Z'));

	expect(saved).toContain('- Legacy fact.\n');
	expect(saved).toContain('- Existing fact. <!-- kucedr:created:2026-10-01T10:00:00.000Z -->');
	expect(saved).toContain(
		'- New summary. <!-- kucedr:summary:work --> <!-- kucedr:created:2026-10-06T09:00:00.000Z -->'
	);
	expect(parseMemories(saved).map(({ fact, createdAt }) => ({ fact, createdAt }))).toEqual([
		{ fact: 'Legacy fact.', createdAt: undefined },
		{ fact: 'Existing fact.', createdAt: '2026-10-01T10:00:00.000Z' },
		{ fact: 'New summary.', createdAt: '2026-10-06T09:00:00.000Z' },
	]);
	expect(recall(saved, 'summary')).toContain('- New summary.');
	expect(recall(saved, 'summary')).not.toContain('kucedr:created');
	expect(
		stampMemories(
			saved.replace('New summary.', 'Updated summary.'),
			saved,
			new Date('2026-10-07T09:00:00.000Z')
		)
	).toContain(
		'Updated summary. <!-- kucedr:summary:work --> <!-- kucedr:created:2026-10-07T09:00:00.000Z -->'
	);
});
