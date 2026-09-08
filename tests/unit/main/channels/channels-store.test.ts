jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/tmp/kucedr-user-data',
}));

import { safeStorage } from 'electron';
import {
	channelsStorePath,
	getChannelProvider,
	listChannelProviders,
	setChannelProvider,
} from '../../../../src/main/channels/channels_store';
import type { StoredChannelProvider } from '../../../../src/shared';

describe('channels store', () => {
	beforeEach(() => {
		(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true);
		(safeStorage.getSelectedStorageBackend as jest.Mock).mockReturnValue('gnome_libsecret');
		(safeStorage.encryptString as jest.Mock).mockImplementation((value: string) =>
			Buffer.from(value, 'utf8')
		);
		(safeStorage.decryptString as jest.Mock).mockImplementation((value: Buffer) =>
			value.toString('utf8')
		);
	});

	it('persists channel providers under settings/channels.json', () => {
		const provider: StoredChannelProvider = {
			id: 'telegram',
			name: 'Telegram',
			apiKey: 'token',
			baseUrl: '',
		};

		expect(channelsStorePath).toBe('/tmp/kucedr-user-data/settings/channels.json');
		expect(listChannelProviders()).toEqual([]);

		setChannelProvider(provider);

		expect(getChannelProvider('telegram')).toEqual(provider);
		expect(safeStorage.encryptString).toHaveBeenCalledWith(
			JSON.stringify({ id: 'telegram', apiKey: 'token' })
		);

		expect(getChannelProvider('telegram')).toEqual(provider);
	});
});
