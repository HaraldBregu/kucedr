const mockOn = jest.fn();
const mockSendVoice = jest.fn();

class MockInputFile {
	constructor(
		readonly data: Buffer,
		readonly fileName: string
	) {}
}

jest.mock('grammy/web', () => ({
	Bot: jest.fn().mockImplementation(() => ({
		on: mockOn,
		catch: jest.fn(),
		api: { sendVoice: mockSendVoice },
	})),
	GrammyError: class extends Error {},
	HttpError: class extends Error {},
	InputFile: MockInputFile,
}));

const { createChannelAdapter } = require('../../../../resources/plugins/telegram/channels/default/source.cjs');

describe('Telegram voice messages', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('registers received voice messages', () => {
		createChannelAdapter({ apiKey: 'token', channel: 'telegram/default' });

		expect(mockOn).toHaveBeenCalledWith('message:voice', expect.any(Function));
	});

	it('sends a native voice message', async () => {
		mockSendVoice.mockResolvedValueOnce({ message_id: 42 });
		const adapter = createChannelAdapter({ apiKey: 'token', channel: 'telegram/default' });
		const receipt = await adapter.send({
			channel: 'telegram',
			to: 'chat-1',
			content: {
				type: 'voice',
				voice: { data: 'YWJj', mimeType: 'audio/mpeg', fileName: 'reply.mp3' },
				fallbackText: 'hello',
			},
		});

		expect(mockSendVoice).toHaveBeenCalledWith(
			'chat-1',
			expect.objectContaining({ fileName: 'reply.mp3' }),
			expect.any(Object)
		);
		expect(receipt.platformMessageIds).toEqual(['42']);
	});

	it('bounds the inbound message deduplication cache', () => {
		const adapter = createChannelAdapter({ apiKey: 'token', channel: 'telegram/default' });
		const receive = jest.fn();
		adapter.onMessage(receive);
		const textHandler = mockOn.mock.calls.find(([event]) => event === 'message:text')?.[1];
		const context = (messageId: number) => ({
			message: { text: 'hello', message_id: messageId },
			chat: { id: 1, type: 'private' },
			from: { id: 2 },
		});

		for (let messageId = 1; messageId <= 10_001; messageId += 1) {
			textHandler(context(messageId));
		}
		textHandler(context(1));

		expect(receive).toHaveBeenCalledTimes(10_002);
	});
});
