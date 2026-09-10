import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { modelsFor } from '@/lib/providers';
import { HomeAgentContext } from '../context/context';
import type {
	RealtimeVoiceEvent,
	RealtimeVoiceState,
	RealtimeVoiceToolEvent,
} from '@shared/realtime_voice';
import { canCaptureAudio, dictationErrorMessage, getAppMicrophoneEnabled } from './audio';
import { usePcmCapture } from './usePcmCapture';
import { usePcmPlayback } from './usePcmPlayback';

export type RealtimeVoiceUiStatus = 'idle' | 'checking-permission' | RealtimeVoiceState | 'error';

const CLOCK_INTERVAL_MS = 250;
const HOME_AGENT_ID = 'main';

function isToolEvent(event: RealtimeVoiceEvent): event is RealtimeVoiceToolEvent {
	return (
		event.type === 'tool_call_start' ||
		event.type === 'tool_call_args_delta' ||
		event.type === 'tool_call_input' ||
		event.type === 'tool_permission_request' ||
		event.type === 'tool_call_result'
	);
}

function messageId(prefix: string, itemId?: string): string {
	return itemId
		? `${prefix}-${itemId}`
		: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function needsVoiceConfiguration(message: string): boolean {
	return /api key|credential|provider|model|not configured|configuration/i.test(message);
}

export function useRealtimeVoice({
	chatSessionId,
	onClosed,
	closeOnError = true,
}: {
	readonly chatSessionId: string;
	readonly onClosed: () => void;
	readonly closeOnError?: boolean;
}) {
	const dispatchChat = useContext(HomeAgentContext)?.dispatchChat ?? (() => undefined);
	const [status, setStatus] = useState<RealtimeVoiceUiStatus>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [requiresConfiguration, setRequiresConfiguration] = useState(false);
	const [elapsedMs, setElapsedMs] = useState(0);
	const {
		analyser: captureAnalyser,
		isMuted,
		setMuted,
		start: startCapture,
		stop: stopCapture,
		stream,
	} = usePcmCapture();
	const {
		analyser: playbackAnalyser,
		enqueue: enqueuePlayback,
		release: releasePlayback,
		start: startPlayback,
		stop: stopPlayback,
	} = usePcmPlayback();

	const mountedRef = useRef(true);
	const onClosedRef = useRef(onClosed);
	const sessionIdRef = useRef<string | null>(null);
	const sessionChatIdRef = useRef<string | null>(null);
	const startRunRef = useRef(0);
	const statusRef = useRef<RealtimeVoiceUiStatus>('idle');
	const startedAtMsRef = useRef(0);
	const clockRef = useRef<number | null>(null);
	const userTurnMessageIdsRef = useRef<Map<string, string>>(new Map());

	const supportedModels = modelsFor('realtime-voice');
	const isConfigured = supportedModels.length > 0;
	const isSupported = canCaptureAudio();
	const isActive = status !== 'idle' && status !== 'error';
	const analyser = status === 'speaking' ? playbackAnalyser : captureAnalyser;

	useEffect(() => {
		onClosedRef.current = onClosed;
	}, [onClosed]);

	useEffect(() => {
		statusRef.current = status;
	}, [status]);

	const stopClock = useCallback((): void => {
		if (clockRef.current === null) return;
		window.clearInterval(clockRef.current);
		clockRef.current = null;
	}, []);

	const releaseAudio = useCallback((): void => {
		stopClock();
		stopCapture();
		releasePlayback();
		if (mountedRef.current) setElapsedMs(0);
	}, [releasePlayback, stopCapture, stopClock]);

	const closeSession = useCallback(
		async (notify = true): Promise<void> => {
			startRunRef.current += 1;
			const sessionId = sessionIdRef.current;
			sessionIdRef.current = null;
			sessionChatIdRef.current = null;
			if (mountedRef.current && statusRef.current !== 'error') setStatus('ending');
			releaseAudio();
			if (sessionId) {
				await window.models.realtimeVoice.stopSession(sessionId).catch((error) => {
					if (!mountedRef.current) return;
					const message = dictationErrorMessage(error);
					setErrorMessage(message);
					setRequiresConfiguration(needsVoiceConfiguration(message));
				});
			}
			if (mountedRef.current && statusRef.current !== 'error') setStatus('idle');
			if (notify) onClosedRef.current();
		},
		[releaseAudio]
	);

	const failSession = useCallback(
		(error: unknown, sessionId = sessionIdRef.current): void => {
			if (!sessionId || sessionIdRef.current !== sessionId) return;
			const message =
				typeof error === 'string' && error.trim() ? error : dictationErrorMessage(error);
			sessionIdRef.current = null;
			sessionChatIdRef.current = null;
			setErrorMessage(message);
			setRequiresConfiguration(needsVoiceConfiguration(message));
			setStatus('error');
			dispatchChat({ type: 'error_active', errorText: message, completedAtMs: Date.now() });
			releaseAudio();
			void window.models.realtimeVoice.stopSession(sessionId).catch(() => undefined);
			if (closeOnError) onClosedRef.current();
		},
		[closeOnError, dispatchChat, releaseAudio]
	);

	useEffect(() => {
		return window.models.realtimeVoice.onSessionEvent((event: RealtimeVoiceEvent) => {
			const sessionId = sessionIdRef.current;
			if (!sessionId || event.sessionId !== sessionId) return;

			if (isToolEvent(event)) {
				dispatchChat({
					type: 'apply_response_event',
					event,
					receivedAtMs: Date.now(),
				});
				return;
			}

			switch (event.type) {
				case 'started':
					setStatus('listening');
					return;
				case 'state':
					setStatus(event.status);
					return;
				case 'input_speech_started':
					stopPlayback();
					setStatus('listening');
					return;
				case 'input_speech_stopped':
					setStatus('thinking');
					return;
				case 'user_turn': {
					const turnKey = event.itemId ?? `turn-${userTurnMessageIdsRef.current.size}`;
					const transcript = event.transcript?.trim();
					const existingMessageId = userTurnMessageIdsRef.current.get(turnKey);
					if (existingMessageId) {
						if (transcript) {
							dispatchChat({
								type: 'update_user_message',
								messageId: existingMessageId,
								content: transcript,
							});
						}
						return;
					}
					const userMessageId = messageId('voice-user', event.itemId);
					userTurnMessageIdsRef.current.set(turnKey, userMessageId);
					dispatchChat({
						type: 'start_voice_turn',
						userMessageId,
						agentMessageId: messageId('voice-agent', event.itemId),
						runId: event.sessionId,
						content: transcript || '',
						startedAtMs: Date.now(),
					});
					return;
				}
				case 'assistant_transcript_delta':
					dispatchChat({
						type: 'apply_response_event',
						event: {
							type: 'text_delta',
							delta: event.delta,
							agentId: HOME_AGENT_ID,
							runId: event.sessionId,
						},
						receivedAtMs: Date.now(),
					});
					return;
				case 'assistant_transcript_final':
					dispatchChat({
						type: 'complete_active',
						response: event.text,
						completedAtMs: Date.now(),
					});
					return;
				case 'assistant_audio_delta':
					setStatus('speaking');
					enqueuePlayback(event.audio);
					return;
				case 'assistant_audio_done':
					return;
				case 'interrupted':
					stopPlayback();
					dispatchChat({ type: 'complete_active', response: '', completedAtMs: Date.now() });
					setStatus('listening');
					return;
				case 'error': {
					failSession(event.message || 'Realtime voice conversation failed.', sessionId);
					return;
				}
				case 'closed':
					sessionIdRef.current = null;
					dispatchChat({ type: 'complete_active', response: '', completedAtMs: Date.now() });
					releaseAudio();
					setStatus('idle');
					onClosedRef.current();
					return;
			}
		});
	}, [dispatchChat, enqueuePlayback, failSession, releaseAudio, stopPlayback]);

	const start = useCallback(async (): Promise<boolean> => {
		if (sessionIdRef.current) return true;
		setErrorMessage(null);
		setRequiresConfiguration(false);
		if (!isConfigured) {
			setErrorMessage('Configure a supported realtime voice provider and model in Settings.');
			setRequiresConfiguration(true);
			setStatus('error');
			return false;
		}
		if (!isSupported) {
			setErrorMessage('Realtime voice is not supported in this environment.');
			setStatus('error');
			return false;
		}

		const runId = startRunRef.current + 1;
		startRunRef.current = runId;
		setStatus('checking-permission');
		setElapsedMs(0);
		userTurnMessageIdsRef.current = new Map();

		try {
			if (!(await getAppMicrophoneEnabled())) {
				throw new Error('Microphone recording is disabled in Settings.');
			}
			if (startRunRef.current !== runId) return false;

			await startPlayback();
			await startCapture((audio) => {
				const sessionId = sessionIdRef.current;
				if (sessionId) {
					void window.models.realtimeVoice
						.appendAudio(sessionId, audio)
						.catch((error) => failSession(error, sessionId));
				}
			});
			if (startRunRef.current !== runId) {
				releaseAudio();
				return false;
			}

			setStatus('connecting');
			const session = await window.models.realtimeVoice.startSession({ chatSessionId });
			if (startRunRef.current !== runId) {
				await window.models.realtimeVoice.stopSession(session.id).catch(() => undefined);
				releaseAudio();
				return false;
			}

			sessionIdRef.current = session.id;
			sessionChatIdRef.current = chatSessionId;
			setStatus('listening');
			startedAtMsRef.current = Date.now();
			clockRef.current = window.setInterval(() => {
				setElapsedMs(Date.now() - startedAtMsRef.current);
			}, CLOCK_INTERVAL_MS);
			return true;
		} catch (error) {
			releaseAudio();
			const message = dictationErrorMessage(error);
			setErrorMessage(message);
			setRequiresConfiguration(needsVoiceConfiguration(message));
			setStatus('error');
			return false;
		}
	}, [
		chatSessionId,
		failSession,
		isConfigured,
			isSupported,
			releaseAudio,
			startCapture,
		startPlayback,
	]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			if (sessionChatIdRef.current === chatSessionId) void closeSession();
		};
	}, [chatSessionId, closeSession]);

	useEffect(() => {
		return () => {
			mountedRef.current = false;
			startRunRef.current += 1;
			const sessionId = sessionIdRef.current;
			sessionIdRef.current = null;
			sessionChatIdRef.current = null;
			releaseAudio();
			if (sessionId) void window.models.realtimeVoice.stopSession(sessionId).catch(() => undefined);
		};
	}, [releaseAudio]);

	return {
		analyser,
		elapsedMs,
		end: closeSession,
		errorMessage,
		isActive,
		isConfigured,
		isMuted,
		isSupported,
		requiresConfiguration,
		setMuted,
		start,
		status,
		stream,
	};
}
