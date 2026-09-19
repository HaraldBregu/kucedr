import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DataController } from '../../../../src/main/data/data_controller';

const sessionId = '11111111-1111-4111-8111-111111111111';

it('exports and purges memory only after a matching one-use preview', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-data-memory-'));
	const workspace = path.join(root, 'workspace');
	await fs.mkdir(workspace, { recursive: true });
	await fs.writeFile(
		path.join(workspace, 'MEMORY.md'),
		'# Memory\n\n- [memory-1234567890abcdef] Prefers concise answers\n',
		'utf8'
	);
	const controller = new DataController({
		config: { location: workspace },
		listSessions: () => [],
		deleteSession: jest.fn(),
		memory: { clear: jest.fn(() => fs.writeFile(path.join(workspace, 'MEMORY.md'), '', 'utf8')) },
	});
	const scope = { kind: 'memory' as const };
	const preview = await controller.previewPurge(scope);
	const exportPath = path.join(root, 'memory-export.json');

	const exported = await controller.export(scope, exportPath);
	const archive = JSON.parse(await fs.readFile(exportPath, 'utf8'));
	const memory = Buffer.from(archive.files[0].data, 'base64').toString('utf8');
	expect(exported).toEqual(expect.objectContaining({ files: 1, scope }));
	expect(memory).toContain('Prefers concise answers');
	await expect(controller.purge(scope, preview.confirmationId)).resolves.toEqual(
		expect.objectContaining({ remoteDataDeleted: false, scope })
	);
	expect(await fs.readFile(path.join(workspace, 'MEMORY.md'), 'utf8')).not.toContain(
		'Prefers concise answers'
	);
	await expect(controller.purge(scope, preview.confirmationId)).rejects.toThrow(
		'confirmation is missing'
	);
	await fs.rm(root, { recursive: true, force: true });
});

it('exports and deletes only explicitly listed sessions through the agent lock boundary', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-data-sessions-'));
	const workspace = path.join(root, 'workspace');
	const sessionDirectory = path.join(root, 'sessions', sessionId);
	await fs.mkdir(sessionDirectory, { recursive: true });
	await fs.writeFile(path.join(sessionDirectory, 'messages.json'), '[{"role":"user"}]\n', 'utf8');
	const deleteSession = jest.fn(async (id: string) => {
		await fs.rm(path.join(root, 'sessions', id), { recursive: true, force: true });
	});
	const controller = new DataController({
		config: { location: workspace },
		listSessions: () => [{ id: sessionId, title: 'Session', createdAtMs: 1 }],
		deleteSession,
	});
	const scope = { kind: 'sessions' as const, sessionIds: [sessionId] };
	const preview = await controller.previewPurge(scope);
	const exportPath = path.join(root, 'sessions-export.json');

	await controller.export(scope, exportPath);
	const archive = JSON.parse(await fs.readFile(exportPath, 'utf8'));
	expect(archive.files[0].path).toBe(`sessions/${sessionId}/messages.json`);
	await controller.purge(scope, preview.confirmationId);
	expect(deleteSession).toHaveBeenCalledWith(sessionId);
	await expect(fs.stat(sessionDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
	await fs.rm(root, { recursive: true, force: true });
});
