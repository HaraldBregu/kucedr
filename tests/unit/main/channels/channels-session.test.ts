import { channelSessionId } from '../../../../src/main/channels/channels_session';
import type { ChannelInboundMessage } from '../../../../src/main/channels/channels_types';

const identity: Pick<ChannelInboundMessage, 'channel' | 'accountId' | 'chatId' | 'threadId'> = {
	channel: 'telegram',
	accountId: 'account-1',
	chatId: 'chat-1',
	threadId: 'thread-1',
};

describe('channelSessionId', () => {
	it('derives a UUIDv5 from the complete channel route without exposing it in the result', () => {
		const sessionId = channelSessionId(identity);
		expect(sessionId).toBe('f3d5954e-564f-51e0-be2f-5058fe95561e');
		expect(sessionId).not.toContain(identity.accountId);
		expect(channelSessionId(identity)).toBe(sessionId);
	});

	it.each([
		['account', { accountId: 'account-2' }],
		['chat', { chatId: 'chat-2' }],
		['thread', { threadId: 'thread-2' }],
		['missing thread', { threadId: undefined }],
	] as const)('uses %s as part of the UUIDv5 name', (_label, patch) => {
		expect(channelSessionId({ ...identity, ...patch })).not.toBe(channelSessionId(identity));
	});
});
