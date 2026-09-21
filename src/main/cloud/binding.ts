import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';

interface AccountBindingStore {
	userId?: string;
}

export class DeviceAccountBinding {
	private readonly store = new Store<AccountBindingStore>({
		name: 'account',
		cwd: path.resolve(userDataLocation(), 'settings'),
		accessPropertiesByDotNotation: false,
	});

	accept(userId: string): boolean {
		const current = this.store.get('userId');
		if (current && current !== userId) return false;
		if (!current) this.store.set('userId', userId);
		return true;
	}

	clear(): void {
		this.store.delete('userId');
	}
}
