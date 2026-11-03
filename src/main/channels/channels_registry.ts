import type { ChannelStatusEvent, ChannelType, StoredChannelProvider } from '../../shared';
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { discoverChannels, resolveChannel } from './catalog';
import { AppChannels } from '../../shared/ipc_channels_definitions';
import type { EventBus } from '../event_bus';
import type { LoggerService } from '../shared';
import type { Agent } from '../agent/agent';
import type { SttAudioInput } from '../../shared/stt_transcription';
import type { SpeechSynthesisResult } from '../../shared/speech_types';
import { getChannelProvider } from './channels_store';
import { getChannelModelSelection } from './channels_store';
import { canReceive } from './channels_security';
import { channelSessionId } from './channels_session';
import { loadChannelVoice } from './channels_voice';
import type {
	ChannelAdapter,
	ChannelInboundMessage,
	ChannelMessageReceipt,
	ChannelOutboundMessage,
	ChannelStatusUpdate,
} from './channels_types';
import { toText } from '../models/transcribe';
import { synthesize } from '../models/voice';

export interface ChannelRegistryDependencies {
	logger: LoggerService;
	eventBus: EventBus;
	agentService?: Agent;
	loadAdapter?: (
		entry: string,
		options: { channel: string; credentials: Record<string, string> }
	) => Promise<ChannelAdapter>;
	transcribeVoice?: (
		audio: SttAudioInput,
		options?: { providerId?: string; modelId?: string }
	) => Promise<string>;
	synthesizeVoice?: (
		text: string,
		options?: { providerId?: string; modelId?: string }
	) => Promise<SpeechSynthesisResult>;
}

export interface ChannelRegistry {
	start(channel: ChannelType): Promise<void>;
	stop(channel: ChannelType): Promise<void>;
	restart(channel: ChannelType): Promise<void>;
	reconcile(): Promise<void>;
	send(message: ChannelOutboundMessage): Promise<ChannelMessageReceipt>;
	getStatus(channel: ChannelType): ChannelStatusEvent | undefined;
	destroy(): Promise<void>;
}

export function createChannelRegistry(dependencies: ChannelRegistryDependencies): ChannelRegistry {
	const { logger, eventBus, agentService } = dependencies;
	const transcribeVoice =
		dependencies.transcribeVoice ??
		(async (audio: SttAudioInput, options?: { providerId?: string; modelId?: string }) => {
			return toText({
				audio,
				...(options?.providerId ? { providerId: options.providerId } : {}),
				...(options?.modelId ? { modelId: options.modelId } : {}),
			});
		});
	const synthesizeVoice =
		dependencies.synthesizeVoice ??
		(async (text: string, options?: { providerId?: string; modelId?: string }) => {
			return synthesize({
				text,
				...(options?.providerId ? { providerId: options.providerId } : {}),
				...(options?.modelId ? { modelId: options.modelId } : {}),
			});
		});
	const adapters = new Map<ChannelType, ChannelAdapter>();
	const statusCache = new Map<ChannelType, ChannelStatusEvent>();
	const revisions = new Map<ChannelType, string>();
	let lifecycle = Promise.resolve();

	function enqueue(operation: () => Promise<void>): Promise<void> {
		const result = lifecycle.then(operation);
		lifecycle = result.catch(() => {});
		return result;
	}

	function revision(contribution: ReturnType<typeof resolveChannel>): string {
		if (!contribution) return '';
		let entryVersion = '';
		try {
			const stat = statSync(contribution.entry);
			entryVersion = `${stat.mtimeMs}:${stat.size}`;
		} catch {}
		return JSON.stringify([contribution, entryVersion]);
	}

	function channelCredential(channel: ChannelType): StoredChannelProvider | undefined {
		return getChannelProvider(channel);
	}

	function handleStatus(channel: ChannelType, update: ChannelStatusUpdate): void {
		const event: ChannelStatusEvent = {
			type: channel,
			status: update.status,
			pairingCode: update.pairingCode,
			error: update.error,
			timestamp: Date.now(),
		};
		statusCache.set(channel, event);
		eventBus.emit('channel:status', event);
		eventBus.broadcast(AppChannels.channelsStatusChanged, event);
	}

	async function handleMessage(message: ChannelInboundMessage): Promise<void> {
		const decision = canReceive(message, channelCredential(message.channel));
		if (!decision.allowed) {
			logger.info('ChannelRegistry', 'Dropped channel message', {
				channel: message.channel,
				chatType: message.chatType,
				reason: decision.reason,
			});
			return;
		}
		const reply = (content: ChannelOutboundMessage['content']) =>
			send({
				channel: message.channel,
				accountId: message.accountId,
				to: message.chatId,
				threadId: message.threadId,
				replyToMessageId: message.messageId,
				chatType: message.chatType,
				content,
				idempotencyKey: `${message.idempotencyKey}:reply`,
			});

		try {
			const text =
				message.content.type === 'text'
					? message.content.text
					: await transcribeVoice(await loadChannelVoice(message.content.voice), {
							...channelModelSelection('stt'),
						});
			if (message.automaticReply) {
				await reply({ type: 'text', text: message.automaticReply });
				return;
			}
			if (!agentService) return;

			eventBus.emit('channel:route', {
				channel: message.channel,
				accountId: message.accountId,
				to: message.chatId,
				threadId: message.threadId,
				replyToMessageId: message.messageId,
				chatType: message.chatType,
			});
			const response = await agentService.send(text, 'channels', {
				type: 'background',
				streaming: false,
				contextMode: 'minimal',
				sessionId: channelSessionId(message),
				...channelModelSelection('llm'),
			});
			if (message.content.type === 'voice') {
				try {
					const voice = await synthesizeVoice(response, {
						...channelModelSelection('tts'),
					});
					await reply({
						type: 'voice',
						voice: {
							data: voice.audio,
							mimeType: voice.mimeType,
							fileName: voiceFileName(voice.mimeType),
						},
						fallbackText: response,
					});
				} catch (error) {
					logger.warn('ChannelRegistry', 'Voice reply failed; sending text', {
						channel: message.channel,
						error: error instanceof Error ? error.message : String(error),
					});
					await reply({ type: 'text', text: response });
				}
			} else {
				await reply({ type: 'text', text: response });
			}
			logger.info('ChannelRegistry', 'Replied to channel message', {
				channel: message.channel,
				chatType: message.chatType,
			});
		} catch (error) {
			logger.error('ChannelRegistry', 'Channel agent reply failed', error);
		}
	}

	async function start(channel: ChannelType): Promise<void> {
		const contribution = resolveChannel(channel);
		if (!contribution) throw new Error('Unknown channel.');
		if (adapters.has(channel)) return;

		const credential = channelCredential(channel);
		const credentials = {
			...credential?.credentials,
			...(credential?.apiKey ? { apiKey: credential.apiKey } : {}),
		};
		if (
			!credential ||
			contribution.credentials.some((item) => item.required && !credentials[item.key]?.trim())
		) {
			logger.warn('ChannelRegistry', `${channel} channel is not configured`);
			return;
		}

		const loadAdapter =
			dependencies.loadAdapter ??
			(async (entry, options) => {
				const require = createRequire(entry);
				delete require.cache[require.resolve(entry)];
				const module = require(entry);
				return module.createChannelAdapter(options) as ChannelAdapter;
			});
		const adapter = await loadAdapter(contribution.entry, { channel, credentials });
		adapter.onStatus((update) => handleStatus(channel, update));
		adapter.onMessage((message) => {
			void handleMessage(message);
		});

		await adapter.start();
		adapters.set(channel, adapter);
		revisions.set(channel, revision(contribution));
		logger.info('ChannelRegistry', `Started ${channel} channel`);
	}

	async function stop(channel: ChannelType): Promise<void> {
		const adapter = adapters.get(channel);
		if (!adapter) return;
		try {
			await adapter.stop();
		} finally {
			adapters.delete(channel);
			revisions.delete(channel);
		}
	}

	async function send(message: ChannelOutboundMessage): Promise<ChannelMessageReceipt> {
		const adapter = adapters.get(message.channel);
		if (!adapter) {
			throw new Error(`${message.channel} channel is not running`);
		}
		return adapter.send(message);
	}

	return {
		start: (channel) => enqueue(() => start(channel)),
		stop: (channel) => enqueue(() => stop(channel)),
		restart: (channel) => enqueue(async () => {
			await stop(channel);
			await start(channel);
		}),
		reconcile: () => enqueue(async () => {
			const available = new Map(discoverChannels().map((channel) => [channel.id, channel]));
			for (const channel of adapters.keys()) {
				const contribution = available.get(channel);
				if (!contribution || revisions.get(channel) !== revision(contribution)) await stop(channel);
			}
			for (const channel of available.keys()) {
				try {
					await start(channel);
				} catch (error) {
					logger.error('ChannelRegistry', `Failed to start ${channel} channel`, error);
				}
			}
		}),
		send,
		getStatus(channel) {
			return statusCache.get(channel);
		},
		destroy: () => enqueue(async () => {
			await Promise.all([...adapters.keys()].map(stop));
		}),
	};
}

function voiceFileName(mimeType: string): string {
	if (mimeType.includes('ogg')) return 'reply.ogg';
	if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'reply.m4a';
	if (mimeType.includes('wav')) return 'reply.wav';
	return 'reply.mp3';
}

function trimOrEmpty(value?: string): string {
	return (value ?? '').trim();
}

function channelModelSelection(kind: 'stt' | 'tts' | 'llm'): {
	providerId?: string;
	modelId?: string;
} {
	const current = getChannelModelSelection(kind);
	const providerId = trimOrEmpty(current.providerId);
	const modelId = trimOrEmpty(current.modelId);
	if (!providerId) return {};
	return { providerId, ...(modelId ? { modelId } : {}) };
}
