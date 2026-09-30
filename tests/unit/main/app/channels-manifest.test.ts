import { loadChannels } from '../../../../src/main/channels/catalog';

describe('channel manifests', () => {
	it('loads channel services and icons from resources/providers', () => {
		const channels = loadChannels();

		expect(channels.map((channel) => channel.provider.id)).toEqual(['telegram']);
		expect(channels[0]).toEqual(
			expect.objectContaining({
				id: 'telegram-bot',
				name: 'Telegram Bot API',
				instructions:
					'Open Telegram, message @BotFather, send /newbot and follow the prompts, then paste the bot token here.',
				credentials: [
					{
						key: 'apiKey',
						label: 'Bot token',
						type: 'password',
						required: true,
					},
				],
				provider: expect.objectContaining({
					id: 'telegram',
					name: 'Telegram',
					iconDarkUrl: expect.stringContaining('/resources/providers/telegram/images/telegram.svg'),
					iconLightUrl: expect.stringContaining(
						'/resources/providers/telegram/images/telegram.svg'
					),
				}),
			})
		);
	});
});
