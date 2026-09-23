import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readActivity } from '../../../../src/main/shared/activity';

it('counts log entries by their dated log filenames', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'kucedr-activity-'));
	await writeFile(path.join(directory, '2026-09-22.log'), 'first\nsecond\n');
	await writeFile(path.join(directory, '2026-09-23.log'), 'only\n');
	await writeFile(path.join(directory, 'notes.log'), 'ignored\n');

	await expect(readActivity(directory)).resolves.toEqual([
		{ date: '2026-09-22', value: 2 },
		{ date: '2026-09-23', value: 1 },
	]);
});
