export interface AuthStorage {
	readonly persistence: 'encrypted' | 'memory';
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export class AuthSessionStorage implements AuthStorage {
	private readonly memory = new Map<string, string>();

	get persistence(): 'encrypted' | 'memory' {
		return 'memory';
	}

	getItem(key: string): string | null {
		return this.memory.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.memory.set(key, value);
	}

	removeItem(key: string): void {
		this.memory.delete(key);
	}
}
