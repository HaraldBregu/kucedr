import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadMessagesBySessionId } from '../../../../src/main/agent/session/session_load_messages_by_session_id';
import { sessionsRoot } from '../../../../src/main/agent/session/session_sessions_root';
import { realtimeVoiceConversationFactory } from '../../../../src/main/agent/realtime_voice/conversation';
import { realtimeVoiceHistory } from '../../../../src/main/agent/realtime_voice/history';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

it('persists only finalized voice transcripts at their reserved turn position', () => {
	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-voice-conversation-'));
	const location = path.join(temporaryRoot, 'agent');
	try {
		const conversation = realtimeVoiceConversationFactory({ location })(SESSION_ID, 'model');
		const voiceSessionId = conversation.persistenceSessionId;
		expect(voiceSessionId).toBeDefined();
		expect(
			JSON.parse(
				fs.readFileSync(path.join(sessionsRoot(location), voiceSessionId!, 'info.json'), 'utf8')
			)
		).toEqual({ type: 'voice' });
		conversation.beginUserTurn('user-1');
		conversation.addAssistantTranscript('First answer.');
		expect(loadMessagesBySessionId(voiceSessionId!, location)).toEqual([
			expect.objectContaining({ role: 'assistant' }),
		]);

		conversation.finalizeUserTurn('user-1', 'First spoken message.');
		conversation.finalizeUserTurn('user-2', 'Second spoken message.');
		conversation.addAssistantTranscript('Second answer.');
		conversation.beginUserTurn('user-2');

		const messages = loadMessagesBySessionId(voiceSessionId!, location);
		expect(messages.map((message) => message.role)).toEqual([
			'user',
			'assistant',
			'user',
			'assistant',
		]);
		expect(messages[0].content).toBe('First spoken message.');
		expect(messages[2].content).toBe('Second spoken message.');
		expect(JSON.stringify(messages)).not.toContain('Voice message');
		expect(realtimeVoiceConversationFactory({ location })(SESSION_ID, 'model').history).toEqual([]);
	} finally {
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	}
});

it('bounds replay to the latest 64 messages and 48,000 characters', () => {
	const messages = Array.from({ length: 80 }, (_, index) => ({
		role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
		content: `message-${index}`,
	}));
	const messageBounded = realtimeVoiceHistory(messages);
	expect(messageBounded).toHaveLength(64);
	expect(messageBounded[0].text).toBe('message-16');
	expect(messageBounded.at(-1)?.text).toBe('message-79');

	const oldest = `oldest-prefix-${'A'.repeat(60_000)}-oldest-tail`;
	const characterBounded = realtimeVoiceHistory([
		{ role: 'user', content: oldest },
		{ role: 'assistant', content: 'latest answer' },
	]);
	expect(characterBounded.reduce((total, message) => total + message.text.length, 0)).toBe(48_000);
	expect(characterBounded[0].text.endsWith('-oldest-tail')).toBe(true);
	expect(characterBounded.at(-1)?.text).toBe('latest answer');
});

it('excludes legacy voice placeholders from provider history', () => {
	expect(
		realtimeVoiceHistory([
			{ role: 'user', content: 'Voice message' },
			{ role: 'user', content: 'Actual transcript' },
		])
	).toEqual([{ role: 'user', text: 'Actual transcript' }]);
});

it('preserves updates from text and two voice writers sharing one coordinator', () => {
	const {
		SessionCoordinator,
		init,
		createSessionState,
		addAssistantMessage,
		releaseSession,
	} = require('../../../../src/main/agent/session');
	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-session-writers-'));
	const config = { location: path.join(temporaryRoot, 'agent') };
	const coordinator = new SessionCoordinator();
	const factory = realtimeVoiceConversationFactory(config, coordinator);
	const first = factory(SESSION_ID, 'model');
	const second = factory(SESSION_ID, 'model');
	const firstVoiceSessionId = first.persistenceSessionId!;
	const secondVoiceSessionId = second.persistenceSessionId!;
	const text = createSessionState();
	try {
		init(
			text,
			config,
			{ task: 'chat', message: 'Text question.', sessionId: SESSION_ID },
			'main',
			coordinator
		);
		first.addAssistantTranscript('First voice.');
		addAssistantMessage(text, 'Text answer.', []);
		second.addAssistantTranscript('Second voice.');
		const textSerialized = JSON.stringify(loadMessagesBySessionId(SESSION_ID, config.location));
		expect(textSerialized).toContain('Text question.');
		expect(textSerialized).toContain('Text answer.');
		expect(JSON.stringify(loadMessagesBySessionId(firstVoiceSessionId, config.location))).toContain(
			'First voice.'
		);
		expect(
			JSON.stringify(loadMessagesBySessionId(secondVoiceSessionId, config.location))
		).toContain('Second voice.');
		releaseSession(text);
		expect(text.lease.signal.aborted).toBe(false);
		addAssistantMessage(text, 'Closed writer callback.', []);
		second.addAssistantTranscript('Still active voice.');
		expect(
			JSON.stringify(loadMessagesBySessionId(firstVoiceSessionId, config.location))
		).not.toContain('Closed writer');
	} finally {
		first.dispose?.();
		second.dispose?.();
		releaseSession(text);
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	}
});

it.each(['clear', 'delete', 'edit'])(
	'invalidates old voice and text writers before %s',
	(operation) => {
		const {
			SessionCoordinator,
			init,
			createSessionState,
			addAssistantMessage,
			clearMessages,
			deleteSession,
			updateUserMessageBySessionId,
			appendRun,
			persistSystemPrompt,
			releaseSession,
		} = require('../../../../src/main/agent/session');
		const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-session-invalidated-'));
		const config = { location: path.join(temporaryRoot, 'agent') };
		const coordinator = new SessionCoordinator();
		const state = createSessionState();
		init(
			state,
			config,
			{ task: 'chat', message: 'Original question.', sessionId: SESSION_ID },
			'main',
			coordinator
		);
		const voice = realtimeVoiceConversationFactory(config, coordinator)(SESSION_ID, 'model');
		const voiceSessionId = voice.persistenceSessionId!;
		try {
			if (operation === 'clear')
				clearMessages(createSessionState(), config, SESSION_ID, coordinator);
			if (operation === 'delete')
				deleteSession(createSessionState(), config, SESSION_ID, coordinator);
			if (operation === 'edit')
				expect(
					updateUserMessageBySessionId(
						SESSION_ID,
						config.location,
						0,
						'Edited question.',
						coordinator
					)
				).toBe(true);
			expect(state.lease.signal.aborted).toBe(true);
			expect(voice.signal?.aborted).toBe(false);
			voice.addAssistantTranscript('Late voice callback.');
			addAssistantMessage(state, 'Late text callback.', []);
			appendRun(state, { type: 'run_finished' });
			persistSystemPrompt(state, 'Late system prompt.');
			const serialized = JSON.stringify(loadMessagesBySessionId(SESSION_ID, config.location));
			const voiceSerialized = JSON.stringify(
				loadMessagesBySessionId(voiceSessionId, config.location)
			);
			expect(serialized).not.toContain('Late');
			expect(voiceSerialized).toContain('Late voice callback.');
			if (operation === 'edit') expect(serialized).toContain('Edited question.');
			else expect(serialized).toBe('[]');
			if (operation === 'delete')
				expect(fs.existsSync(path.join(state.sessionsPath, state.folderName))).toBe(false);
			expect(fs.existsSync(path.join(state.sessionsPath, voiceSessionId))).toBe(true);
		} finally {
			voice.dispose?.();
			releaseSession(state);
			fs.rmSync(temporaryRoot, { recursive: true, force: true });
		}
	}
);

it('keeps deferred prompts private until validation accepts them and preserves concurrent voice updates', () => {
	const {
		SessionCoordinator,
		createSessionState,
		init,
		persist,
		releaseSession,
	} = require('../../../../src/main/agent/session');
	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-session-deferred-'));
	const config = { location: path.join(temporaryRoot, 'agent') };
	const coordinator = new SessionCoordinator();
	const voice = realtimeVoiceConversationFactory(config, coordinator)(SESSION_ID, 'model');
	const voiceSessionId = voice.persistenceSessionId!;
	const state = createSessionState();
	try {
		init(
			state,
			config,
			{
				task: 'chat',
				message: 'Accepted pending prompt.',
				sessionId: SESSION_ID,
				deferPersist: true,
			},
			'main',
			coordinator
		);
		voice.addAssistantTranscript('Concurrent voice answer.');
		expect(JSON.stringify(loadMessagesBySessionId(SESSION_ID, config.location))).not.toContain(
			'pending prompt'
		);
		persist(state);
		let content = JSON.stringify(loadMessagesBySessionId(SESSION_ID, config.location));
		expect(content).toContain('Accepted pending prompt.');
		expect(JSON.stringify(loadMessagesBySessionId(voiceSessionId, config.location))).toContain(
			'Concurrent voice answer.'
		);
		releaseSession(state);
		init(
			state,
			config,
			{
				task: 'chat',
				message: 'Rejected pending prompt.',
				sessionId: SESSION_ID,
				deferPersist: true,
			},
			'main',
			coordinator
		);
		releaseSession(state);
		voice.addAssistantTranscript('Another voice answer.');
		content = JSON.stringify(loadMessagesBySessionId(SESSION_ID, config.location));
		expect(content).not.toContain('Rejected pending prompt.');
		expect(JSON.stringify(loadMessagesBySessionId(voiceSessionId, config.location))).toContain(
			'Another voice answer.'
		);
	} finally {
		voice.dispose?.();
		releaseSession(state);
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	}
});
