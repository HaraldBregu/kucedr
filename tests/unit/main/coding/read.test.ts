import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CodingProject } from '../../../../src/shared/coding_types';
import { readProjectFile } from '../../../../src/main/coding/read';

it('previews text while rejecting outside paths, symlinks, binary and oversized files', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'kucedr-coder-read-'));
	const root = path.join(directory, 'project');
	await mkdir(root);
	const project: CodingProject = {
		id: 'project', name: 'project', directory: root, kind: 'external',
		createdAt: '', lastOpenedAt: '', available: true,
	};
	try {
		await writeFile(path.join(root, 'hello.ts'), 'const hello = "world";');
		await writeFile(path.join(directory, 'outside.ts'), 'outside');
		await symlink(path.join(directory, 'outside.ts'), path.join(root, 'linked.ts'));
		await writeFile(path.join(root, 'binary'), Buffer.from([0, 1]));
		await writeFile(path.join(root, 'large'), Buffer.alloc(2 * 1024 * 1024 + 1, 65));
		expect(await readProjectFile(project, 'hello.ts')).toBe('const hello = "world";');
		await expect(readProjectFile(project, '../outside.ts')).rejects.toThrow('inside the project');
		await expect(readProjectFile(project, 'linked.ts')).rejects.toThrow('inside the project');
		await expect(readProjectFile(project, 'binary')).rejects.toThrow('Binary files');
		await expect(readProjectFile(project, 'large')).rejects.toThrow('2 MB');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
