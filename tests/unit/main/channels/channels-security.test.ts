import { canReceive } from '../../../../src/main/channels/channels_security';
import type { ChannelInboundMessage } from '../../../../src/main/channels/channels_types';

type Config = Parameters<typeof canReceive>[1];

function config(overrides: Partial<Config> = {}): Config {
	return {
		id: 'telegram',
		name: 'Telegram',
		apiKey: 'tok',
		baseUrl: '',
		allowFrom: [],
		...overrides,
	} as Config;
}

function message(overrides: Partial<ChannelInboundMessage> = {}): ChannelInboundMessage {
	return {
		channel: 'telegram',
		accountId: 'acc',
		senderId: 'u1',
		chatId: 'c1',
		chatType: 'group',
		messageId: 'm1',
		content: { type: 'text', text: 'hello' },
		idempotencyKey: 'k1',
		receivedAt: 0,
		...overrides,
	};
}

describe('canReceive', () => {
	it('rejects disabled channels', () => {
		expect(canReceive(message(), undefined)).toEqual({
			allowed: false,
			reason: 'channel_not_configured',
		});
	});
	it('applies access policy to credentialless channels', () => {
		expect(canReceive(message(), config({ apiKey: '', groupAllowFrom: ['c1'] }))).toEqual({
			allowed: true,
		});
	});
	it('rejects empty text', () => {
		expect(canReceive(message({ content: { type: 'text', text: '   ' } }), config()).reason).toBe(
			'empty_text'
		);
	});
	it('allows valid voice metadata without loading audio', () => {
		const load = jest.fn();
		expect(
			canReceive(
				message({
					content: {
						type: 'voice',
						voice: { mimeType: 'audio/ogg', byteLength: 1024, load },
					},
				}),
				config({ groupAllowFrom: ['c1'] })
			)
		).toEqual({ allowed: true });
		expect(load).not.toHaveBeenCalled();
	});
	it('rejects oversized voice metadata without loading audio', () => {
		const load = jest.fn();
		expect(
			canReceive(
				message({
					content: {
						type: 'voice',
						voice: { mimeType: 'audio/ogg', byteLength: 21 * 1024 * 1024, load },
					},
				}),
				config()
			).reason
		).toBe('voice_too_large');
		expect(load).not.toHaveBeenCalled();
	});

	describe('direct messages', () => {
		const dm = (o: Partial<ChannelInboundMessage> = {}) => message({ chatType: 'dm', ...o });
		it('open policy allows anyone', () => {
			expect(canReceive(dm(), config({ dmPolicy: 'open' }))).toEqual({ allowed: true });
		});
		it('pairing policy requires pairing', () => {
			expect(canReceive(dm(), config({ dmPolicy: 'pairing' })).reason).toBe('pairing_required');
		});
		it('deny policy blocks', () => {
			expect(canReceive(dm(), config({ dmPolicy: 'deny' })).reason).toBe('dm_denied');
		});
		it('allowlist (default) blocks unknown senders', () => {
			expect(canReceive(dm({ senderId: 'x' }), config({ allowFrom: ['y'] })).reason).toBe(
				'sender_not_allowed'
			);
		});
		it('allowlist admits listed senders', () => {
			expect(canReceive(dm({ senderId: 'y' }), config({ allowFrom: ['y'] }))).toEqual({
				allowed: true,
			});
		});
	});

	describe('group messages', () => {
		it('blocks all chats when no group allowlist is configured', () => {
			expect(canReceive(message(), config()).reason).toBe('route_not_allowed');
		});
		it('blocks chats not on the group allowlist', () => {
			expect(canReceive(message({ chatId: 'c9' }), config({ groupAllowFrom: ['c1'] })).reason).toBe(
				'route_not_allowed'
			);
		});
		it('allows chats on the group allowlist', () => {
			expect(canReceive(message({ chatId: 'c1' }), config({ groupAllowFrom: ['c1'] }))).toEqual({
				allowed: true,
			});
		});
	});
});
