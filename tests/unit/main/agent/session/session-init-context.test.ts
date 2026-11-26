import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	addAssistantMessage,
	createSessionState,
	init,
} from '../../../../../src/main/agent/session';
import { EXPIRED_SKILL_CONTEXT } from '../../../../../src/main/agent/session/session_sanitize_messages';
import type { ToolCall } from '../../../../../src/main/agent/types';

describe('session context boundaries', () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
		roots.length = 0;
	});

	it('expires stored skill instructions while preserving skills loaded in the current run', () => {
		const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-session-context-'));
		roots.push(temporaryRoot);
		const location = path.join(temporaryRoot, 'agent');
		const config = { location, workspace: buildWorkspace('default', temporaryRoot, location) };
		const sessionId = '11111111-1111-4111-8111-111111111111';
		const historicalSkill: ToolCall = {
			id: 'skill-old',
			name: 'load_skill',
			args: { name: 'writer' },
			result: { content: 'historical skill instructions' },
		};
		const first = createSessionState();
		init(first, config, { task: 'chat', message: '', sessionId });
		addAssistantMessage(first, '', [historicalSkill]);

		const restored = createSessionState();
		init(restored, config, { task: 'chat', message: 'new request', sessionId });
		expect(restored.messages[0].toolCalls?.[0].result?.content).toBe(EXPIRED_SKILL_CONTEXT);

		const currentSkill: ToolCall = {
			id: 'skill-current',
			name: 'load_skill',
			args: { name: 'reviewer' },
			result: { content: 'current skill instructions' },
		};
		addAssistantMessage(restored, '', [currentSkill]);
		expect(restored.messages.at(-1)?.toolCalls?.[0].result?.content).toBe(
			'current skill instructions'
		);
	});
});
