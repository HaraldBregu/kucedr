import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRun } from '../../../../../src/main/agent/session/session_append_run';
import { atomicWriteFile } from '../../../../../src/main/agent/session/session_atomic_write';
import { loadMessagesBySessionId } from '../../../../../src/main/agent/session/session_load_messages_by_session_id';
import { messagesBackupFilePath } from '../../../../../src/main/agent/session/session_messages_backup_file_path';
import { messagesFilePath } from '../../../../../src/main/agent/session/session_messages_file_path';
import { createSessionState } from '../../../../../src/main/agent/session/session_module_state';
import { persist } from '../../../../../src/main/agent/session/session_persist';
import { runFilePath } from '../../../../../src/main/agent/session/session_run_file_path';
import { sessionsRoot } from '../../../../../src/main/agent/session/session_sessions_root';
import { insertUserMessage } from '../../../../../src/main/agent/session/session_insert_user_message';
import { updateUserMessageBySessionId } from '../../../../../src/main/agent/session/session_update_user_message_by_session_id';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

describe('session persistence', () => {
	let temporaryRoot: string;

	beforeEach(() => {
		temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-session-persist-'));
	});

	afterEach(() => {
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	});

	it('keeps the target intact and removes the temporary file when rename fails', () => {
		const target = path.join(temporaryRoot, 'messages.json');
		fs.writeFileSync(target, 'old', 'utf8');
		const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
			throw new Error('interrupted');
		});

		expect(() => atomicWriteFile(target, 'new')).toThrow('interrupted');
		rename.mockRestore();
		expect(fs.readFileSync(target, 'utf8')).toBe('old');
		expect(fs.readdirSync(temporaryRoot)).toEqual(['messages.json']);
	});

	it('recovers from a corrupt transcript using the last known good backup', () => {
		const location = path.join(temporaryRoot, 'agent');
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = sessionsRoot(location);
		state.messages = [{ role: 'user', content: 'first' }];
		persist(state);
		state.messages = [{ role: 'user', content: 'second' }];
		persist(state);

		expect(JSON.parse(fs.readFileSync(messagesBackupFilePath(state), 'utf8'))).toEqual([
			{ role: 'user', content: 'first' },
		]);
		fs.writeFileSync(messagesFilePath(state), '{corrupt', 'utf8');

		expect(loadMessagesBySessionId(SESSION_ID, location)).toEqual([
			{ role: 'user', content: 'first' },
		]);
		expect(JSON.parse(fs.readFileSync(messagesBackupFilePath(state), 'utf8'))).toEqual([
			{ role: 'user', content: 'first' },
		]);
	});

	it('inserts a finalized voice transcript at its reserved position', () => {
		const location = path.join(temporaryRoot, 'agent');
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = sessionsRoot(location);
		state.messages = [
			{ role: 'user', content: 'Earlier message' },
			{ role: 'assistant', content: 'Later response' },
		];

		insertUserMessage(state, 1, 'Show the message I sent.');

		expect(loadMessagesBySessionId(SESSION_ID, location)).toEqual([
			{ role: 'user', content: 'Earlier message' },
			{ role: 'user', content: 'Show the message I sent.' },
			{ role: 'assistant', content: 'Later response' },
		]);
	});

	it('updates a stored user message and discards later turns', () => {
		const location = path.join(temporaryRoot, 'agent');
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = sessionsRoot(location);
		state.messages = [
			{ role: 'user', content: 'First question' },
			{ role: 'assistant', content: 'First answer' },
			{ role: 'user', content: 'Second question' },
			{ role: 'assistant', content: 'Second answer' },
		];
		persist(state);

		expect(updateUserMessageBySessionId(SESSION_ID, location, 1, 'Updated question')).toBe(
			true
		);
		expect(loadMessagesBySessionId(SESSION_ID, location)).toEqual([
			{ role: 'user', content: 'Updated question' },
		]);
	});

	it('stores attachment payloads as verified session blobs instead of transcript base64', () => {
		const location = path.join(temporaryRoot, 'agent');
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = sessionsRoot(location);
		const base64 = Buffer.from('attachment payload').toString('base64');
		state.messages = [
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Read this.' },
					{ type: 'file', name: 'note.txt', mimeType: 'text/plain', base64 },
				],
			},
		];

		persist(state);

		const stored = fs.readFileSync(messagesFilePath(state), 'utf8');
		expect(stored).not.toContain(base64);
		expect(stored).toContain('"attachment"');
		expect(
			fs.readdirSync(path.join(path.dirname(messagesFilePath(state)), 'attachments'))
		).toHaveLength(1);
		expect(loadMessagesBySessionId(SESSION_ID, location)[0].content).toEqual(
			state.messages[0].content
		);
	});

	it('writes only semantic run events and skips raw deltas', () => {
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = path.join(temporaryRoot, 'sessions');
		appendRun(state, { type: 'model_call_delta', delta: 'private answer' });
		appendRun(state, {
			type: 'tool_call_end',
			toolCallId: 'call-1',
			toolName: 'read',
			input: { path: '/private/file' },
			output: 'private contents',
			durationMs: 4,
		});
		expect(fs.existsSync(runFilePath(state))).toBe(false);
		appendRun(state, {
			type: 'run_finished',
			result: { sessionId: SESSION_ID, text: 'private final answer' },
		});

		const trace = fs.readFileSync(runFilePath(state), 'utf8');
		expect(trace.trim().split('\n')).toHaveLength(2);
		expect(trace).toContain('"durationMs":4');
		expect(trace).not.toContain('private answer');
		expect(trace).not.toContain('private final answer');
		expect(trace).not.toContain('/private/file');
		expect(trace).not.toContain('private contents');
		expect(state.runTraceBuffer).toEqual([]);
	});

	it('records privacy-safe MCP discovery counts and failure phases', () => {
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = path.join(temporaryRoot, 'sessions');
		appendRun(state, {
			type: 'run_started',
			sessionId: SESSION_ID,
			model: 'model',
			providerId: 'provider',
			tools: ['read'],
			mcpDiscovery: {
				configuredServers: 1,
				enabledServers: 1,
				connectedServers: 0,
				listedTools: 0,
				loadedTools: 0,
				rejectedTools: 0,
				truncated: false,
				failures: [{ serverId: 'resend', phase: 'connect' }],
			},
		});
		appendRun(state, { type: 'run_finished', result: { sessionId: SESSION_ID, text: '' } });

		const trace = fs.readFileSync(runFilePath(state), 'utf8');
		expect(trace).toContain(
			'"mcpDiscovery":{"configuredServers":1,"enabledServers":1,"connectedServers":0'
		);
		expect(trace).toContain('"serverId":"resend","phase":"connect"');
	});
});
