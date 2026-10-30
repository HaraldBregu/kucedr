import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';

interface SelectionState {
	/** userId → pluginId → active cloud credential id. */
	users: Record<string, Record<string, string>>;
}

/** The cloud key each plugin uses for the signed-in account; plugins without one use their local key. */
export class CredentialSelection {
	constructor(
		private readonly userId: () => string | undefined,
		private readonly store: Store<SelectionState> = new Store<SelectionState>({
			name: 'selection',
			cwd: path.resolve(userDataLocation(), 'credentials'),
			accessPropertiesByDotNotation: false,
			defaults: { users: {} },
		})
	) {}

	all(): Record<string, string> {
		const userId = this.userId();
		return userId ? { ...this.store.get('users')[userId] } : {};
	}

	get(pluginId: string): string | undefined {
		return this.all()[pluginId];
	}

	set(pluginId: string, credentialId: string | undefined): void {
		const userId = this.userId();
		if (!userId) throw new Error('Sign in to choose cloud API keys.');
		const { [pluginId]: _previous, ...rest } = this.all();
		this.write(userId, credentialId ? { ...rest, [pluginId]: credentialId } : rest);
	}

	clear(credentialId: string): void {
		const userId = this.userId();
		if (!userId) return;
		this.write(
			userId,
			Object.fromEntries(Object.entries(this.all()).filter(([, id]) => id !== credentialId))
		);
	}

	private write(userId: string, selection: Record<string, string>): void {
		this.store.set('users', { ...this.store.get('users'), [userId]: selection });
	}
}
