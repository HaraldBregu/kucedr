import { loadChannels } from '../../../../src/main/channels/catalog';

describe('channel manifests', () => {
	it('loads channel services and icons from resources/channels', () => {
		const channels = loadChannels();

		expect(channels.map((channel) => channel.provider.id)).toEqual(['telegram']);
		expect(channels[0]).toEqual(
			expect.objectContaining({
				id: 'telegram-bot',
				name: 'Telegram Bot API',
				provider: expect.objectContaining({
					id: 'telegram',
					name: 'Telegram',
					iconDarkUrl: expect.stringContaining(
						'/resources/channels/telegram/images/svg/telegram-color.svg'
					),
					iconLightUrl: expect.stringContaining(
						'/resources/channels/telegram/images/svg/telegram-color.svg'
					),
				}),
			})
		);
	});
});
