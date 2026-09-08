import { CHANNEL_DEFAULT_DM_POLICY, type StoredChannelProvider } from '../../shared';
import type { ChannelInboundMessage } from './channels_types';
import { CHANNEL_MAX_VOICE_BYTES } from './channels_voice';

export interface ChannelSecurityDecision {
	allowed: boolean;
	reason?: string;
}

/** Whether an inbound message may reach the agent, per the bot credential's rules. */
export function canReceive(
	message: ChannelInboundMessage,
	credential: StoredChannelProvider | undefined
): ChannelSecurityDecision {
	if (!credential?.apiKey.trim()) {
		return { allowed: false, reason: 'channel_not_configured' };
	}
	if (message.content.type === 'text' && !message.content.text.trim()) {
		return { allowed: false, reason: 'empty_text' };
	}
	if (message.content.type === 'voice') {
		if (!message.content.voice.mimeType.startsWith('audio/')) {
			return { allowed: false, reason: 'unsupported_voice_type' };
		}
		if (
			message.content.voice.byteLength &&
			message.content.voice.byteLength > CHANNEL_MAX_VOICE_BYTES
		) {
			return { allowed: false, reason: 'voice_too_large' };
		}
	}
	if (message.chatType === 'dm') {
		const dmPolicy = credential.dmPolicy ?? CHANNEL_DEFAULT_DM_POLICY;
		if (dmPolicy === 'open') return { allowed: true };
		if (dmPolicy === 'pairing') return { allowed: false, reason: 'pairing_required' };
		if (dmPolicy === 'deny') return { allowed: false, reason: 'dm_denied' };
		if (!(credential.allowFrom ?? []).includes(message.senderId)) {
			return { allowed: false, reason: 'sender_not_allowed' };
		}
		return { allowed: true };
	}
	const groupAllowFrom = credential.groupAllowFrom ?? [];
	if (!groupAllowFrom.includes(message.chatId)) {
		return { allowed: false, reason: 'route_not_allowed' };
	}
	return { allowed: true };
}
