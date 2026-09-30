import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRun } from '../../../../../src/main/agent/session/session_append_run';
import { atomicWriteFile } from '../../../../../src/main/agent/session/session_atomic_write';
import { loadMessagesBySessionId } from '../../../../../src/main/agent/session/session_load_messages_by_session_id';
import { listSessions } from '../../../../../src/main/agent/session/session_list_sessions';
import { messagesBackupFilePath } from '../../../../../src/main/agent/session/session_messages_backup_file_path';
import { messagesFilePath } from '../../../../../src/main/agent/session/session_messages_file_path';
import { createSessionState } from '../../../../../src/main/agent/session/session_module_state';
import { persist } from '../../../../../src/main/agent/session/session_persist';
import { runFilePath } from '../../../../../src/main/agent/session/session_run_file_path';
import { sessionsRoot } from '../../../../../src/main/agent/session/session_sessions_root';
import { insertUserMessage } from '../../../../../src/main/agent/session/session_insert_user_message';
import { deleteSession } from '../../../../../src/main/agent/session/session_delete_session';
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

	it('reports the latest transcript or run update for a session', () => {
		const location = path.join(temporaryRoot, 'agent');
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = sessionsRoot(location);
		state.messages = [{ role: 'user', content: 'Plan today' }];
		persist(state);
		const directory = path.join(state.sessionsPath, SESSION_ID);
		const transcriptTime = new Date('2020-01-02T00:00:00Z');
		const runTime = new Date('2020-01-03T00:00:00Z');
		const oldTime = new Date('2020-01-01T00:00:00Z');
		fs.utimesSync(messagesFilePath(state), transcriptTime, transcriptTime);
		fs.utimesSync(runFilePath(state), oldTime, oldTime);
		fs.utimesSync(directory, oldTime, oldTime);
		expect(listSessions(location)[0].updatedAtMs).toBe(transcriptTime.getTime());
		fs.writeFileSync(runFilePath(state), '{}\n');
		fs.utimesSync(runFilePath(state), runTime, runTime);
		fs.utimesSync(directory, oldTime, oldTime);
		expect(listSessions(location)[0].updatedAtMs).toBe(runTime.getTime());
	});

	it('deletes only the session folder matching the selected id', () => {
		const location = path.join(temporaryRoot, 'workspace');
		const otherId = '22222222-2222-4222-8222-222222222222';
		for (const id of [SESSION_ID, otherId]) {
			const state = createSessionState();
			state.id = id;
			state.folderName = id;
			state.sessionsPath = sessionsRoot(location);
			state.messages = [{ role: 'user', content: id }];
			persist(state);
		}

		deleteSession(createSessionState(), { location } as Parameters<typeof deleteSession>[1], SESSION_ID);

		expect(fs.existsSync(path.join(sessionsRoot(location), SESSION_ID))).toBe(false);
		expect(fs.existsSync(path.join(sessionsRoot(location), otherId))).toBe(true);
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

		expect(updateUserMessageBySessionId(SESSION_ID, location, 1, 'Updated question')).toBe(true);
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
					{ type: 'file', name: 'note.txt', mimeType: 'text/plain', path: '/tmp/note.txt', base64 },
				],
			},
		];

		persist(state);

		const stored = fs.readFileSync(messagesFilePath(state), 'utf8');
		expect(stored).not.toContain(base64);
		expect(stored).toContain('"attachment"');
		expect(stored).toContain('"path": "/tmp/note.txt"');
		expect(
			fs.readdirSync(path.join(path.dirname(messagesFilePath(state)), 'attachments'))
		).toHaveLength(1);
		expect(loadMessagesBySessionId(SESSION_ID, location)[0].content).toEqual(
			state.messages[0].content
		);
	});

	it('persists and restores an attachment above the former file-size cap', () => {
		const location = path.join(temporaryRoot, 'agent');
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = sessionsRoot(location);
		const base64 = Buffer.alloc(20 * 1024 * 1024 + 1).toString('base64');
		state.messages = [{
			role: 'user',
			content: [{ type: 'image', name: 'large.png', mimeType: 'image/png', base64 }],
		}];

		persist(state);

		expect(loadMessagesBySessionId(SESSION_ID, location)[0].content).toEqual(state.messages[0].content);
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
		const diagnostics = {
			configuredServers: 1,
			enabledServers: 1,
			connectedServers: 0,
			listedTools: 0,
			loadedTools: 0,
			rejectedTools: 0,
			truncated: false,
			failures: [{ serverId: 'resend', phase: 'connect' }],
		};
		appendRun(state, {
			type: 'run_started',
			sessionId: SESSION_ID,
			model: 'model',
			providerId: 'provider',
			tools: ['read', 'mcp__resend__send_email'],
			mcpDiscovery: diagnostics,
		});
		diagnostics.connectedServers = 1;
		diagnostics.listedTools = 3;
		diagnostics.loadedTools = 2;
		appendRun(state, { type: 'run_finished', result: { sessionId: SESSION_ID, text: '' } });

		const trace = fs.readFileSync(runFilePath(state), 'utf8');
		expect(trace).toContain('"localToolCount":1,"mcpToolCount":1');
		expect(trace).toContain(
			'"mcpDiscovery":{"phase":"initial","configuredServers":1,"enabledServers":1,"connectedServers":0,"listedMcpTools":0,"catalogedMcpTools":0'
		);
		expect(trace).toContain(
			'"type":"mcp_discovery_result","mcpDiscovery":{"phase":"final","configuredServers":1,"enabledServers":1,"connectedServers":1,"listedMcpTools":3,"catalogedMcpTools":2'
		);
		expect(trace).toContain('"serverId":"resend","phase":"connect"');
	});

	it('records privacy-safe progressive selection IDs without model rationale', () => {
		const state = createSessionState();
		state.id = SESSION_ID;
		state.folderName = SESSION_ID;
		state.sessionsPath = path.join(temporaryRoot, 'sessions');
		appendRun(state, {
			type: 'capability_resolution_result',
			tools: [
				{ id: 'read', name: 'Read' },
				{ id: 'mcp__gmail__send', name: 'Send', serviceId: 'gmail', serviceName: 'Gmail' },
			],
			serviceIds: ['gmail'],
		});
		appendRun(state, { type: 'run_finished', result: { sessionId: SESSION_ID, text: '' } });

		const trace = fs.readFileSync(runFilePath(state), 'utf8');
		expect(trace).toContain(
			'"selectedToolIds":["read","mcp__gmail__send"],"selectedServiceCount":1,"selectedServiceIds":["gmail"]'
		);
		expect(trace).not.toContain('private rationale');
		expect(trace).not.toContain('serviceName');
	});
});
