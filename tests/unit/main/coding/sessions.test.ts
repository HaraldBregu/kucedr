import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CoderSessions } from '../../../../src/main/coding/sessions';
import type { CodingSettings } from '../../../../src/shared/coding_types';

const settings: CodingSettings = {
	runtime: 'codex', providerId: 'openai', modelId: 'model', thinkingLevel: 'medium', toolMode: 'coding',
};

it('keeps session metadata and journals in their workspace across restarts and deletes both', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'coder-sessions-'));
	const records = path.join(root, 'sessions', 'records');
	const sessions = new CoderSessions(records);
	const session = sessions.create('workspace-1', root, settings, 'Task');
	const directory = path.join(root, 'workspaces', 'workspace-1', 'sessions');
	sessions.append(session.id, { type: 'text', text: 'Hello' } as never);
	expect(existsSync(path.join(directory, session.id + '.json'))).toBe(true);
	expect(existsSync(path.join(directory, session.id + '.jsonl'))).toBe(true);
	const reloaded = new CoderSessions(records);
	expect(reloaded.list('workspace-1')).toEqual([session]);
	expect(reloaded.list('workspace-2')).toEqual([]);
	expect(reloaded.delete(session.id)).toBe(true);
	expect(existsSync(path.join(directory, session.id + '.json'))).toBe(false);
	expect(existsSync(path.join(directory, session.id + '.jsonl'))).toBe(false);
});

it('continues reading and updating legacy session files without relocating them', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'coder-sessions-'));
	const records = path.join(root, 'sessions', 'records');
	mkdirSync(records, { recursive: true });
	const session = {
		id: 'legacy', projectId: 'workspace-1', runtime: 'codex', workingDirectory: root,
		settings, title: 'Old task', createdAt: '2026-01-01', updatedAt: '2026-01-01', messageCount: 0,
	};
	writeFileSync(path.join(records, 'legacy.json'), JSON.stringify(session));
	const sessions = new CoderSessions(records);
	const loaded = sessions.read('legacy');
	expect(loaded).toEqual(session);
	sessions.save({ ...loaded!, title: 'Updated task' });
	expect(new CoderSessions(records).list('workspace-1')[0].title).toBe('Updated task');
	expect(existsSync(path.join(records, 'legacy.json'))).toBe(true);
	expect(existsSync(path.join(root, 'workspaces', 'workspace-1', 'sessions', 'legacy.json'))).toBe(false);
});
