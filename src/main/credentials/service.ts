import { randomBytes, randomUUID } from 'node:crypto';
import type {
	CloudCredential,
	CloudCredentialInput,
	CloudCredentialService,
	CredentialVaultStatus,
} from '../../shared/credential_types';
import type { ResolvedProvider } from '../../shared/provider_types';
import type { AccountSession } from '../cloud/account';
import { derive } from './derive';
import { open } from './open';
import { seal, type SavedCredential, type SealedFile } from './seal';
import { CLOUD_SERVICES } from './services';

export interface CredentialAuthPort {
	getSignedInUserId(): string | undefined;
	onSessionChanged(listener: (session: AccountSession | null) => void): () => void;
}

export interface CredentialFilePort {
	read(userId: string): Promise<string | null>;
	write(userId: string, text: string): Promise<void>;
}

export interface CredentialKeyPort {
	get(userId: string): Buffer | undefined;
	set(userId: string, key: Buffer): void;
	delete(userId: string): void;
}

interface Unlocked {
	userId: string;
	key: Buffer;
	salt: Buffer;
	entries: SavedCredential[];
}

const MAX_KEYS = 200;

/**
 * Model keys kept in one passphrase-encrypted file per account. Encryption happens in the main
 * process; the backend stores ciphertext only and never sees the passphrase or the keys.
 */
export class CredentialService {
	private unlocked: Unlocked | undefined;
	private userId: string | undefined;
	private queue: Promise<unknown> = Promise.resolve();
	private unsubscribe?: () => void;

	constructor(
		private readonly auth: CredentialAuthPort,
		private readonly files: CredentialFilePort | null,
		private readonly keys: CredentialKeyPort,
		private readonly request: typeof fetch = fetch
	) {}

	initialize(): void {
		if (this.unsubscribe) return;
		this.userId = this.auth.getSignedInUserId();
		void this.restore();
		this.unsubscribe = this.auth.onSessionChanged((session) => {
			if (session?.user.id === this.userId) return;
			this.userId = session?.user.id;
			this.unlocked = undefined;
			void this.restore();
		});
	}

	destroy(): void {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.unlocked = undefined;
	}

	async status(): Promise<CredentialVaultStatus> {
		const userId = this.auth.getSignedInUserId();
		if (!userId || !this.files) return 'signed-out';
		if (this.unlocked?.userId === userId) return 'unlocked';
		return (await this.files.read(userId)) ? 'locked' : 'empty';
	}

	async unlock(passphrase: string): Promise<void> {
		const userId = this.requireUser();
		const file = await this.read(userId);
		const salt = file ? Buffer.from(file.salt, 'base64') : randomBytes(16);
		const key = await derive(passphrase, salt);
		const entries = file ? open(key, userId, file) : [];
		if (!file) await this.storage().write(userId, seal(key, salt, userId, entries));
		this.commit({ userId, key, salt, entries });
		this.keys.set(userId, key);
	}

	lock(): void {
		const userId = this.auth.getSignedInUserId();
		if (userId) this.keys.delete(userId);
		this.unlocked = undefined;
	}

	async list(): Promise<CloudCredential[]> {
		return (await this.latest()).entries.map(strip);
	}

	create(input: CloudCredentialInput): Promise<CloudCredential> {
		return this.change((entries) => {
			if (entries.length >= MAX_KEYS) throw new Error(`You can save up to ${MAX_KEYS} API keys.`);
			const now = new Date().toISOString();
			const entry: SavedCredential = {
				id: randomUUID(),
				service: input.service,
				label: input.label,
				secret: input.secret,
				lastFour: lastFour(input.secret),
				createdAt: now,
				updatedAt: now,
			};
			return { entries: [...entries, entry], result: strip(entry) };
		});
	}

	replace(id: string, secret: string): Promise<CloudCredential> {
		return this.update(id, { secret, lastFour: lastFour(secret) });
	}

	rename(id: string, label: string): Promise<CloudCredential> {
		return this.update(id, { label });
	}

	async remove(id: string): Promise<void> {
		await this.change((entries) => ({
			entries: entries.filter((entry) => entry.id !== id),
			result: undefined,
		}));
	}

	async test(id: string): Promise<boolean> {
		const entry = this.entry(id);
		const service = CLOUD_SERVICES[entry.service];
		let response: Response;
		try {
			response = await this.request(`${service.baseURL}${service.test}`, {
				headers: service.headers(entry.secret),
				redirect: 'error',
				signal: AbortSignal.timeout(10_000),
			});
		} catch {
			throw new Error('Could not reach the provider. Check your connection.');
		}
		await response.body?.cancel();
		if (response.ok) return true;
		if (response.status === 401 || response.status === 403) return false;
		throw new Error('The provider is unavailable. Try again later.');
	}

	provider(providerId: string, credentialId: string, baseURL?: string): ResolvedProvider {
		const entry = this.entry(credentialId);
		return {
			id: providerId,
			apiKey: entry.secret,
			baseURL: baseURL || CLOUD_SERVICES[entry.service].baseURL,
		};
	}

	/** The saved key holding this secret, if any; lets local uploads skip duplicates. */
	findSecret(service: CloudCredentialService, secret: string): string | undefined {
		if (!this.unlocked || this.unlocked.userId !== this.auth.getSignedInUserId()) return undefined;
		return this.unlocked.entries.find((entry) => entry.service === service && entry.secret === secret)
			?.id;
	}

	private async restore(): Promise<void> {
		const userId = this.auth.getSignedInUserId();
		const key = userId && this.files ? this.keys.get(userId) : undefined;
		if (!userId || !key) return;
		const file = await this.read(userId).catch(() => null);
		if (!file) return;
		try {
			const salt = Buffer.from(file.salt, 'base64');
			this.commit({ userId, key, salt, entries: open(key, userId, file) });
		} catch {
			this.keys.delete(userId);
		}
	}

	private async latest(): Promise<Unlocked> {
		const current = this.requireUnlocked();
		const file = await this.read(current.userId);
		if (!file) {
			this.lock();
			throw new Error('Your keys file was removed. Set a new passphrase.');
		}
		return this.commit({ ...current, entries: open(current.key, current.userId, file) });
	}

	// ponytail: read-modify-write per change, serialized on this device; two devices saving in the
	// same moment means last write wins. Add a storage version check if that ever matters.
	private change<T>(
		apply: (entries: SavedCredential[]) => { entries: SavedCredential[]; result: T }
	): Promise<T> {
		const run = this.queue.then(async () => {
			const current = await this.latest();
			const { entries, result } = apply(current.entries);
			await this.storage().write(current.userId, seal(current.key, current.salt, current.userId, entries));
			this.commit({ ...current, entries });
			return result;
		});
		this.queue = run.catch(() => undefined);
		return run;
	}

	private update(id: string, patch: Partial<SavedCredential>): Promise<CloudCredential> {
		return this.change((entries) => {
			const existing = entries.find((entry) => entry.id === id);
			if (!existing) throw new Error('This API key no longer exists.');
			const entry = { ...existing, ...patch, updatedAt: new Date().toISOString() };
			return {
				entries: entries.map((candidate) => (candidate.id === id ? entry : candidate)),
				result: strip(entry),
			};
		});
	}

	private commit(next: Unlocked): Unlocked {
		if (this.auth.getSignedInUserId() !== next.userId) throw new Error('The signed-in account changed.');
		this.unlocked = next;
		return next;
	}

	private entry(id: string): SavedCredential {
		const entry = this.requireUnlocked().entries.find((candidate) => candidate.id === id);
		if (!entry) throw new Error('This API key no longer exists.');
		return entry;
	}

	private requireUnlocked(): Unlocked {
		const userId = this.requireUser();
		if (this.unlocked?.userId !== userId)
			throw new Error('Unlock your cloud API keys in Settings → Cloud API keys.');
		return this.unlocked;
	}

	private requireUser(): string {
		this.storage();
		const userId = this.auth.getSignedInUserId();
		if (!userId) throw new Error('Sign in to use cloud API keys.');
		return userId;
	}

	private storage(): CredentialFilePort {
		if (!this.files) throw new Error('Cloud API keys are unavailable in this build.');
		return this.files;
	}

	private async read(userId: string): Promise<SealedFile | null> {
		const text = await this.storage().read(userId);
		if (!text) return null;
		const file = JSON.parse(text) as Partial<SealedFile>;
		if (
			file.v !== 1 ||
			[file.salt, file.iv, file.tag, file.data].some((value) => typeof value !== 'string')
		)
			throw new Error('Your keys file is damaged.');
		return file as SealedFile;
	}
}

function strip({ secret: _secret, ...credential }: SavedCredential): CloudCredential {
	return credential;
}

function lastFour(secret: string): string | null {
	return secret.length >= 16 ? secret.slice(-4) : null;
}
