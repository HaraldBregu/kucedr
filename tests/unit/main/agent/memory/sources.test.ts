import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanSources } from '../../../../../src/main/memory/sources';
import { snapshotMarkdown } from '../../../../../src/main/memory/snapshot';

it('scans UUID memory snapshots of every agent type with stable fingerprints and edit detection', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-memory-sources-'));
	const ids = [
		'11111111-1111-4111-8111-111111111111',
		'22222222-2222-4222-8222-222222222222',
		'33333333-3333-4333-8333-333333333333',
	];
	try {
		for (const [index, id] of ids.entries()) {
			await fs.writeFile(
				path.join(root, `${id}.md`),
				snapshotMarkdown(
					id,
					[{ role: 'user', content: index === 0 ? 'x'.repeat(9000) : 'original transcript' }],
					new Date(`2026-09-${String(12 - index).padStart(2, '0')}T12:00:00.000Z`)
				)
			);
		}
		await fs.writeFile(path.join(root, 'MEMORY.md'), '# Consolidated memory');
		await fs.writeFile(path.join(root, 'settings.json'), '{}');
		await fs.writeFile(path.join(root, 'not-a-session.md'), '# Notes');

		const first = await scanSources(root);
		expect(first.map((source) => source.id)).toEqual([...ids].reverse());
		expect(first[2].messages.map((message) => message.text.length)).toEqual([4000, 4000, 1000]);
		expect(await scanSources(root)).toEqual(first);

		await fs.writeFile(
			path.join(root, `${ids[1]}.md`),
			snapshotMarkdown(ids[1], [
				{ role: 'user', content: 'inserted transcript' },
				{ role: 'user', content: 'original transcript' },
			])
		);
		const inserted = await scanSources(root);
		expect(inserted.at(-1)?.id).toBe(ids[1]);
		expect(inserted.at(-1)?.messages[1].fingerprint).toBe(first[1].messages[0].fingerprint);

		await fs.writeFile(
			path.join(root, `${ids[1]}.md`),
			snapshotMarkdown(ids[1], [{ role: 'user', content: 'edited transcript' }])
		);
		expect((await scanSources(root)).at(-1)?.messages[0].fingerprint).not.toBe(
			first[1].messages[0].fingerprint
		);
		await fs.writeFile(path.join(root, `${ids[1]}.md`), '{invalid');
		await expect(scanSources(root)).rejects.toThrow('memory processing will retry');
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
