import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionsRoot } from '../../../../../src/main/agent/session/session_sessions_root';
import { sessionPath } from '../../../../../src/main/agent/session/session_session_path';
import { sessionDir } from '../../../../../src/main/agent/session/session_session_dir';
import { messagesFilePath } from '../../../../../src/main/agent/session/session_messages_file_path';
import { runFilePath } from '../../../../../src/main/agent/session/session_run_file_path';
import { legacyFilePath } from '../../../../../src/main/agent/session/session_legacy_file_path';
import { messagesFile } from '../../../../../src/main/agent/session/session_messages_file';
import { createSessionState } from '../../../../../src/main/agent/session/session_module_state';
import type { SessionState } from '../../../../../src/main/agent/session/session_types';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FAKE_ROOT = '/kucedr-session-paths-absent';

function stateWith(sessionsPath: string, folderName: string): SessionState {
	return { ...createSessionState(), sessionsPath, folderName };
}

describe('sessionsRoot', () => {
	it('uses the sessions directory beside the resolved location', () => {
		expect(sessionsRoot('/tmp/agent')).toBe('/tmp/sessions');
	});
	it('resolves relative locations', () => {
		expect(sessionsRoot('agent')).toBe(path.join(path.dirname(path.resolve('agent')), 'sessions'));
	});
});

describe('sessionPath', () => {
	it('joins the sessions root with a UUID folder', () => {
		expect(sessionPath('/a/b', SESSION_ID)).toBe(path.join('/a/b', SESSION_ID));
	});

	it.each(['.', '..', 'home', 'a/b'])('rejects the unsafe session id %j', (sessionId) => {
		expect(() => sessionPath('/a/b', sessionId)).toThrow('Invalid assistant session id.');
	});

	it('rejects a UUID symlink that resolves outside the sessions root', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-sessions-'));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-outside-'));
		try {
			fs.symlinkSync(
				outside,
				path.join(root, SESSION_ID),
				process.platform === 'win32' ? 'junction' : 'dir'
			);
			expect(() => sessionPath(root, SESSION_ID)).toThrow(
				'Session path escapes the sessions directory.'
			);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('rejects a session file symlink that resolves outside the sessions root', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-sessions-'));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-outside-'));
		try {
			const folder = path.join(root, SESSION_ID);
			fs.mkdirSync(folder);
			fs.symlinkSync(path.join(outside, 'messages.json'), path.join(folder, 'messages.json'));
			expect(() => messagesFile(root, SESSION_ID)).toThrow(
				'Session path escapes the sessions directory.'
			);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});
});

describe('sessionDir / messagesFilePath / runFilePath', () => {
	const state = stateWith(path.join(FAKE_ROOT, 'sessions/main'), SESSION_ID);
	it('sessionDir joins sessionsPath and folderName', () => {
		expect(sessionDir(state)).toBe(path.join(FAKE_ROOT, 'sessions/main', SESSION_ID));
	});
	it('messagesFilePath appends messages.json', () => {
		expect(messagesFilePath(state)).toBe(
			path.join(FAKE_ROOT, 'sessions/main', SESSION_ID, 'messages.json')
		);
	});
	it('runFilePath appends run.jsonl', () => {
		expect(runFilePath(state)).toBe(
			path.join(FAKE_ROOT, 'sessions/main', SESSION_ID, 'run.jsonl')
		);
	});
});

describe('legacyFilePath', () => {
	it('sanitizes the id and appends .json', () => {
		expect(legacyFilePath(FAKE_ROOT, 'a/b')).toBe(path.join(FAKE_ROOT, 'a_b.json'));
	});
});

describe('messagesFile', () => {
	it('builds the messages.json path for a UUID session id', () => {
		expect(messagesFile(FAKE_ROOT, SESSION_ID)).toBe(
			path.join(FAKE_ROOT, SESSION_ID, 'messages.json')
		);
	});
});

describe('createSessionState', () => {
	it('returns fresh default state', () => {
		const s = createSessionState();
		expect(s.maxTurns).toBe(20);
		expect(s.numTurns).toBe(0);
		expect(s.model).toBe('default');
		expect(s.messages).toEqual([]);
		expect(s.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
		expect(s.runContext).toEqual({
			loadedSkills: [],
			fileAccess: { readDirectories: new Set(), createdFiles: new Set() },
			fileHistory: { operations: [] },
		});
	});
	it('returns a new object each call', () => {
		expect(createSessionState()).not.toBe(createSessionState());
	});
});
