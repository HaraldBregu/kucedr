import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { realPath } from '../../../../src/main/shared/real_path';

describe('realPath', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-policy-'));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it('resolves symlinks in existing paths', () => {
		const outside = path.join(tempDir, 'outside');
		const link = path.join(tempDir, 'agent', 'link');
		fs.mkdirSync(path.dirname(link), { recursive: true });
		fs.mkdirSync(outside);
		fs.symlinkSync(outside, link);

		expect(realPath(link)).toBe(fs.realpathSync(outside));
	});

	it('resolves the nearest existing parent for a new target', () => {
		const outside = path.join(tempDir, 'outside');
		const link = path.join(tempDir, 'agent', 'link');
		fs.mkdirSync(path.dirname(link), { recursive: true });
		fs.mkdirSync(outside);
		fs.symlinkSync(outside, link);

		expect(realPath(path.join(link, 'new', 'file.txt'))).toBe(
			path.join(fs.realpathSync(outside), 'new', 'file.txt'),
		);
	});
});
