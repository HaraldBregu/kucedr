import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { readWorkspaceAsset } from '../../../../src/main/ipc/asset';
import { createWorkspaceEntry } from '../../../../src/main/ipc/create';
import { deleteWorkspaceFile } from '../../../../src/main/ipc/delete';
import { deleteWorkspaceDirectory } from '../../../../src/main/ipc/directory';
import { duplicateWorkspaceFile } from '../../../../src/main/ipc/duplicate';
import { writeWorkspaceMarkdown } from '../../../../src/main/ipc/markdown';
import { moveWorkspaceEntry } from '../../../../src/main/ipc/move';
import { renameWorkspaceEntry } from '../../../../src/main/ipc/rename';
import { readWorkspaceTree } from '../../../../src/main/ipc/tree';
import { readWorkspaceTextFile } from '../../../../src/main/ipc/text';
import { resolveWorkspaceFile } from '../../../../src/main/ipc/workspace';
import { writeWorkspaceFile } from '../../../../src/main/ipc/write';
import { workspaceFileType } from '../../../../src/shared/workspace';

describe('workspace files', () => {
	it('duplicates files without overwriting existing copies', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		await fs.writeFile(path.join(root, 'image.bin'), Buffer.from([0, 1, 2, 255]));

		await expect(duplicateWorkspaceFile(root, 'image.bin')).resolves.toBe('image copy.bin');
		await expect(duplicateWorkspaceFile(root, 'image.bin')).resolves.toBe('image copy 2.bin');
		expect(await fs.readFile(path.join(root, 'image copy.bin'))).toEqual(Buffer.from([0, 1, 2, 255]));
		await fs.rm(root, { recursive: true });
	});

	it('classifies editable documents and previewable assets', () => {
		expect(workspaceFileType('notes/idea.md')).toEqual({
			kind: 'markdown',
			mimeType: 'text/markdown',
		});
		expect(workspaceFileType('diagrams/flow.mmd')).toEqual({
			kind: 'mermaid',
			mimeType: 'text/vnd.mermaid',
		});
		expect(workspaceFileType('diagrams/flow.mermaid')).toEqual({
			kind: 'mermaid',
			mimeType: 'text/vnd.mermaid',
		});
		expect(workspaceFileType('drawings/idea.excalidraw')).toEqual({
			kind: 'excalidraw',
			mimeType: 'application/vnd.excalidraw+json',
		});
		expect(workspaceFileType('drawings/idea.excalidraw.json')).toEqual({
			kind: 'excalidraw',
			mimeType: 'application/vnd.excalidraw+json',
		});
		expect(workspaceFileType('drawings/idea.tldr')).toEqual({
			kind: 'tldraw',
			mimeType: 'application/vnd.tldraw+json',
		});
		expect(workspaceFileType('images/photo.webp')).toEqual({
			kind: 'image',
			mimeType: 'image/webp',
		});
		expect(workspaceFileType('audio/theme.mp3')).toEqual({
			kind: 'audio',
			mimeType: 'audio/mpeg',
		});
		expect(workspaceFileType('video/demo.mp4')).toEqual({
			kind: 'video',
			mimeType: 'video/mp4',
		});
		expect(workspaceFileType('docs/manual.pdf')).toEqual({
			kind: 'pdf',
			mimeType: 'application/pdf',
		});
		expect(workspaceFileType('src/component.vue')).toEqual({ kind: 'text', mimeType: 'text/plain' });
		expect(workspaceFileType('script.rb')).toEqual({ kind: 'text', mimeType: 'text/plain' });
		expect(workspaceFileType('archive.zip')).toEqual({ kind: 'unsupported' });
	});

	it('reads UTF-8 code and rejects binary data', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		await fs.writeFile(path.join(root, 'script.py'), 'print("hello")\n');
		await fs.writeFile(path.join(root, 'binary.dat'), Buffer.from([0xff, 0xfe, 0x00]));

		await expect(readWorkspaceTextFile(root, 'script.py')).resolves.toBe('print("hello")\n');
		await expect(readWorkspaceTextFile(root, 'binary.dat')).rejects.toThrow(
			'This binary file cannot be displayed as code.'
		);
		await fs.rm(root, { recursive: true });
	});

	it('resolves existing files inside the real workspace', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		const directory = path.join(root, 'notes');
		const file = path.join(directory, 'idea.md');
		const dottedFile = path.join(root, '..notes.md');
		await fs.mkdir(directory);
		await fs.writeFile(file, '# Idea');
		await fs.writeFile(dottedFile, '# Dotted');

		await expect(resolveWorkspaceFile(root, 'notes/idea.md')).resolves.toBe(
			await fs.realpath(file)
		);
		await expect(resolveWorkspaceFile(root, '..notes.md')).resolves.toBe(
			await fs.realpath(dottedFile)
		);
		await fs.rm(root, { recursive: true });
	});

	it('lists file size and creation and update dates', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		const directory = path.join(root, 'notes');
		const file = path.join(directory, 'idea.md');
		await fs.mkdir(directory);
		await fs.writeFile(file, '# Idea');
		const stats = await fs.stat(file);

		await expect(readWorkspaceTree(root)).resolves.toEqual([
			{
				name: 'notes',
				path: 'notes',
				type: 'directory',
				children: [
					{
						name: 'idea.md',
						path: path.join('notes', 'idea.md'),
						type: 'file',
						size: 6,
						createdAt: (stats.birthtimeMs > 0 ? stats.birthtime : stats.mtime).toISOString(),
						updatedAt: stats.mtime.toISOString(),
					},
				],
			},
		]);
		await fs.rm(root, { recursive: true });
	});

	it('rejects traversal and symlink escapes', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-outside-'));
		const outsideFile = path.join(outside, 'private.md');
		await fs.writeFile(outsideFile, '# Private');
		await fs.symlink(outsideFile, path.join(root, 'linked.md'));

		await expect(resolveWorkspaceFile(root, '../private.md')).rejects.toThrow('outside workspace');
		await expect(resolveWorkspaceFile(root, 'linked.md')).rejects.toThrow('outside workspace');
		await fs.rm(root, { recursive: true });
		await fs.rm(outside, { recursive: true });
	});

	it('writes Markdown and reads typed binary assets', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		const markdown = path.join(root, 'notes.md');
		const text = path.join(root, 'notes.txt');
		const image = path.join(root, 'photo.png');
		const directory = path.join(root, 'folder');
		await fs.writeFile(markdown, '# Before');
		await fs.writeFile(text, 'Before');
		await fs.writeFile(image, new Uint8Array([1, 2, 3]));
		await fs.mkdir(directory);

		await writeWorkspaceMarkdown(root, 'notes.md', '# After');
		await expect(fs.readFile(markdown, 'utf8')).resolves.toBe('# After');
		await expect(writeWorkspaceMarkdown(root, 'notes.txt', 'After')).rejects.toThrow(
			'Only Markdown'
		);
		await expect(readWorkspaceAsset(root, 'photo.png')).resolves.toEqual({
			mimeType: 'image/png',
			data: new Uint8Array([1, 2, 3]),
		});
		await expect(readWorkspaceAsset(root, 'notes.txt')).rejects.toThrow('supported asset');
		await deleteWorkspaceFile(root, 'notes.txt');
		await expect(fs.stat(text)).rejects.toThrow();
		await expect(deleteWorkspaceFile(root, 'folder')).rejects.toThrow('not a file');
		await fs.rm(root, { recursive: true });
	});

	it('writes every editable workspace document kind', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		const files = ['notes.md', 'flow.mmd', 'sketch.excalidraw', 'canvas.tldr', 'notes.txt'];
		for (const file of files) await fs.writeFile(path.join(root, file), 'Before');
		await fs.writeFile(path.join(root, 'archive.zip'), 'Before');

		for (const file of files) {
			await writeWorkspaceFile(root, file, `After ${file}`);
			await expect(fs.readFile(path.join(root, file), 'utf8')).resolves.toBe(`After ${file}`);
		}
		await expect(writeWorkspaceFile(root, 'archive.zip', 'After')).rejects.toThrow(
			'cannot be edited'
		);

		await fs.rm(root, { recursive: true });
	});

	it('creates files and folders without overwriting existing entries', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		await fs.mkdir(path.join(root, 'notes'));

		await expect(createWorkspaceEntry(root, '', 'draft.md', 'file')).resolves.toBe('draft.md');
		await expect(createWorkspaceEntry(root, 'notes', 'ideas', 'directory')).resolves.toBe(
			'notes/ideas'
		);
		await expect(createWorkspaceEntry(root, '', 'draft.md', 'file')).rejects.toThrow(
			'already exists'
		);
		await expect(createWorkspaceEntry(root, '', '../escape.md', 'file')).rejects.toThrow(
			'valid name'
		);
		await expect(createWorkspaceEntry(root, '', 'nested/name.md', 'file')).rejects.toThrow(
			'valid name'
		);

		await fs.rm(root, { recursive: true });
	});

	it('recursively deletes folders but never the workspace root or a file', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		await fs.mkdir(path.join(root, 'folder'));
		await fs.writeFile(path.join(root, 'folder', 'note.md'), '# Note');
		await fs.writeFile(path.join(root, 'note.md'), '# Note');

		await deleteWorkspaceDirectory(root, 'folder');
		await expect(fs.stat(path.join(root, 'folder'))).rejects.toThrow();
		await expect(deleteWorkspaceDirectory(root, '.')).rejects.toThrow('root cannot be deleted');
		await expect(deleteWorkspaceDirectory(root, 'note.md')).rejects.toThrow('not a folder');

		await fs.rm(root, { recursive: true });
	});

	it('does not follow workspace symlinks when deleting', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		const targetFile = path.join(root, 'target.md');
		const targetDirectory = path.join(root, 'target');
		await fs.writeFile(targetFile, '# Keep');
		await fs.mkdir(targetDirectory);
		await fs.writeFile(path.join(targetDirectory, 'keep.md'), '# Keep');
		await fs.symlink(targetFile, path.join(root, 'file-link.md'));
		await fs.symlink(targetDirectory, path.join(root, 'directory-link'));

		await expect(deleteWorkspaceFile(root, 'file-link.md')).rejects.toThrow('symlinks');
		await expect(deleteWorkspaceDirectory(root, 'directory-link')).rejects.toThrow('symlinks');
		await expect(fs.readFile(targetFile, 'utf8')).resolves.toBe('# Keep');
		await expect(fs.readFile(path.join(targetDirectory, 'keep.md'), 'utf8')).resolves.toBe(
			'# Keep'
		);

		await fs.rm(root, { recursive: true });
	});

	it('moves files and folders without overwriting or creating directory cycles', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		await fs.mkdir(path.join(root, 'source'));
		await fs.mkdir(path.join(root, 'destination'));
		await fs.writeFile(path.join(root, 'source', 'note.md'), '# Note');
		await fs.writeFile(path.join(root, 'source', 'inside.txt'), 'Inside');

		await expect(moveWorkspaceEntry(root, 'source/note.md', 'destination')).resolves.toBe(
			'destination/note.md'
		);
		await expect(fs.readFile(path.join(root, 'destination', 'note.md'), 'utf8')).resolves.toBe(
			'# Note'
		);
		await expect(moveWorkspaceEntry(root, 'source', 'destination')).resolves.toBe(
			'destination/source'
		);
		await expect(
			fs.readFile(path.join(root, 'destination', 'source', 'inside.txt'), 'utf8')
		).resolves.toBe('Inside');
		await expect(moveWorkspaceEntry(root, 'destination', 'destination/source')).rejects.toThrow(
			'cannot be moved into itself'
		);
		await expect(
			moveWorkspaceEntry(root, 'destination/source', 'destination/note.md')
		).rejects.toThrow('not a folder');
		await fs.writeFile(path.join(root, 'note.md'), '# Existing');
		await expect(moveWorkspaceEntry(root, 'destination/note.md', '')).rejects.toThrow(
			'already exists'
		);
		await expect(moveWorkspaceEntry(root, '.', 'destination')).rejects.toThrow(
			'root cannot be moved'
		);
		await fs.symlink(path.join(root, 'destination'), path.join(root, 'destination-link'));
		await expect(moveWorkspaceEntry(root, 'destination-link', '')).rejects.toThrow('symlinks');
		await expect(moveWorkspaceEntry(root, 'note.md', 'destination-link')).rejects.toThrow(
			'symlinks'
		);

		await fs.rm(root, { recursive: true });
	});

	it('renames files and folders without overwriting or escaping the workspace', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-workspace-'));
		await fs.mkdir(path.join(root, 'folder'));
		await fs.writeFile(path.join(root, 'folder', 'note.md'), '# Note');
		await fs.writeFile(path.join(root, 'existing.md'), '# Existing');

		await expect(renameWorkspaceEntry(root, 'folder/note.md', 'idea.md')).resolves.toBe(
			'folder/idea.md'
		);
		await expect(fs.readFile(path.join(root, 'folder', 'idea.md'), 'utf8')).resolves.toBe('# Note');
		await expect(renameWorkspaceEntry(root, 'folder/idea.md', 'Idea.md')).resolves.toBe(
			'folder/Idea.md'
		);
		await expect(renameWorkspaceEntry(root, 'folder', 'archive')).resolves.toBe('archive');
		await expect(renameWorkspaceEntry(root, 'archive/Idea.md', '../escape.md')).rejects.toThrow(
			'valid name'
		);
		await expect(renameWorkspaceEntry(root, 'archive/Idea.md', 'existing.md')).resolves.toBe(
			'archive/existing.md'
		);
		await expect(renameWorkspaceEntry(root, 'archive/existing.md', 'existing.md')).resolves.toBe(
			'archive/existing.md'
		);
		await fs.writeFile(path.join(root, 'archive', 'taken.md'), '# Taken');
		await expect(renameWorkspaceEntry(root, 'archive/existing.md', 'taken.md')).rejects.toThrow(
			'already exists'
		);
		await expect(renameWorkspaceEntry(root, '.', 'workspace')).rejects.toThrow(
			'root cannot be renamed'
		);
		await fs.symlink(path.join(root, 'archive'), path.join(root, 'archive-link'));
		await expect(renameWorkspaceEntry(root, 'archive-link', 'renamed-link')).rejects.toThrow(
			'symlinks'
		);

		await fs.rm(root, { recursive: true });
	});
});
