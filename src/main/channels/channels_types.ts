import type { ChannelConnectionStatus, ChannelType } from '../../shared';
import type { SttAudioInput } from '../../shared/stt_transcription';

export type ChannelChatType = 'dm' | 'group' | 'channel' | 'thread';

export interface ChannelInboundVoice {
	mimeType: string;
	fileName?: string;
	byteLength?: number;
	durationSeconds?: number;
	load(): Promise<SttAudioInput>;
}

export type ChannelInboundContent =
	| { type: 'text'; text: string }
	| { type: 'voice'; voice: ChannelInboundVoice };

export interface ChannelOutboundVoice {
	data: string;
	mimeType: string;
	fileName?: string;
}

export type ChannelOutboundContent =
	| { type: 'text'; text: string }
	| { type: 'voice'; voice: ChannelOutboundVoice; fallbackText: string };

export interface ChannelInboundMessage {
	channel: ChannelType;
	accountId: string;
	senderId: string;
	senderName?: string;
	chatId: string;
	chatType: ChannelChatType;
	messageId: string;
	threadId?: string;
	content: ChannelInboundContent;
	idempotencyKey: string;
	receivedAt: number;
}

export interface ChannelOutboundMessage {
	channel: ChannelType;
	to: string;
	content: ChannelOutboundContent;
	accountId?: string;
	threadId?: string;
	replyToMessageId?: string;
	chatType?: ChannelChatType;
	idempotencyKey?: string;
}

export interface ChannelDeliveryPart {
	platformMessageId?: string;
	timestamp: number;
}

export interface ChannelMessageReceipt {
	channel: ChannelType;
	accountId?: string;
	to: string;
	status: 'sent' | 'partial' | 'failed';
	platformMessageIds: string[];
	parts: ChannelDeliveryPart[];
	error?: string;
	sentAt: number;
}

export interface ChannelStatusUpdate {
	status: ChannelConnectionStatus;
	pairingCode?: string;
	error?: string;
}

export type ChannelInboundHandler = (message: ChannelInboundMessage) => void;
export type ChannelStatusHandler = (update: ChannelStatusUpdate) => void;

export interface ChannelAdapter {
	start(): Promise<void>;
	stop(): Promise<void>;
	send(message: ChannelOutboundMessage): Promise<ChannelMessageReceipt>;
	onMessage(handler: ChannelInboundHandler): () => void;
	onStatus(handler: ChannelStatusHandler): () => void;
}
