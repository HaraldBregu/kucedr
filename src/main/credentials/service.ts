import {
	CLOUD_CREDENTIAL_SERVICES,
	type CloudCredential,
	type CloudCredentialInput,
} from '../../shared/credential_types';
import type { ResolvedProvider } from '../../shared/provider_types';
import type { AccountSession } from '../cloud/account';
import type { CloudConfig } from '../cloud/config';

export interface CredentialAuthPort {
	getAccessToken(): string | null;
	getSignedInUserId(): string | undefined;
	onSessionChanged(listener: (session: AccountSession | null) => void): () => void;
}

const GATEWAY_PLACEHOLDER_KEY = 'kucedr-gateway';

export class CredentialService {
	private controller = new AbortController();
	private userId: string | undefined;
	private unsubscribe?: () => void;
	private readonly removedListeners = new Set<(id: string) => void>();

	constructor(
		private readonly auth: CredentialAuthPort,
		private readonly config: CloudConfig | null,
		private readonly request: typeof fetch = fetch
	) {}

	initialize(): void {
		if (this.unsubscribe) return;
		this.userId = this.auth.getSignedInUserId();
		this.unsubscribe = this.auth.onSessionChanged((session) => {
			if (session?.user.id === this.userId) return;
			this.userId = session?.user.id;
			this.controller.abort(new Error('The signed-in account changed.'));
			this.controller = new AbortController();
		});
	}

	destroy(): void {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.controller.abort();
	}

	async list(): Promise<CloudCredential[]> {
		const { credentials } = await this.call<{ credentials: CloudCredential[] }>({ action: 'list' });
		return credentials.filter((credential) =>
			(CLOUD_CREDENTIAL_SERVICES as readonly string[]).includes(credential.service)
		);
	}

	async create(input: CloudCredentialInput, requestId?: string): Promise<CloudCredential> {
		const { credential } = await this.call<{ credential: CloudCredential }>({
			action: 'create',
			...input,
			...(requestId ? { requestId } : {}),
		});
		return credential;
	}

	async replace(id: string, secret: string): Promise<CloudCredential> {
		const { credential } = await this.call<{ credential: CloudCredential }>({
			action: 'replace',
			id,
			secret,
		});
		return credential;
	}

	async rename(id: string, label: string): Promise<CloudCredential> {
		const { credential } = await this.call<{ credential: CloudCredential }>({
			action: 'rename',
			id,
			label,
		});
		return credential;
	}

	async test(id: string): Promise<boolean> {
		const { valid } = await this.call<{ valid: boolean }>({ action: 'test', id });
		return valid;
	}

	async remove(id: string): Promise<void> {
		await this.call({ action: 'delete', id });
		this.removedListeners.forEach((listener) => listener(id));
	}

	/** Chat provider that reaches the model through the backend gateway; never holds the saved key. */
	provider(providerId: string, credentialId: string): ResolvedProvider {
		const userId = this.auth.getSignedInUserId();
		if (!this.config) throw new Error('Cloud API keys are unavailable in this build.');
		if (!userId) throw new Error('Sign in to use the selected cloud API key.');
		const config = this.config;
		return {
			id: providerId,
			apiKey: GATEWAY_PLACEHOLDER_KEY,
			baseURL: `${config.url}/functions/v1/model-gateway/${credentialId}`,
			fetch: (input, init) => {
				const token = this.auth.getAccessToken();
				if (!token || this.auth.getSignedInUserId() !== userId) {
					return Promise.reject(new Error('Sign in to use the selected cloud API key.'));
				}
				const headers = new Headers(init?.headers);
				headers.delete('x-api-key');
				headers.set('authorization', `Bearer ${token}`);
				headers.set('apikey', config.publishableKey);
				const signal = init?.signal
					? AbortSignal.any([init.signal, this.controller.signal])
					: this.controller.signal;
				return this.request(input, { ...init, headers, signal });
			},
		};
	}

	private async call<T>(body: Record<string, unknown>): Promise<T> {
		if (!this.config) throw new Error('Cloud API keys are unavailable in this build.');
		const userId = this.auth.getSignedInUserId();
		const token = this.auth.getAccessToken();
		if (!userId || !token) throw new Error('Sign in to manage cloud API keys.');
		let response: Response;
		try {
			response = await this.request(`${this.config.url}/functions/v1/credentials`, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${token}`,
					apikey: this.config.publishableKey,
					'content-type': 'application/json',
				},
				body: JSON.stringify(body),
				signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(30_000)]),
			});
		} catch {
			if (this.auth.getSignedInUserId() !== userId) throw new Error('The signed-in account changed.');
			throw new Error('Could not reach the credential service. Check your connection.');
		}
		const data = (await response.json().catch(() => ({}))) as { error?: unknown };
		if (this.auth.getSignedInUserId() !== userId) throw new Error('The signed-in account changed.');
		if (response.ok) return data as T;
		if (response.status === 401) throw new Error('Your session has expired. Sign in again.');
		if (response.status === 404) throw new Error('This API key no longer exists.');
		if (response.status === 429) throw new Error('Too many requests. Try again shortly.');
		if (response.status === 400) throw new Error('The API key details are invalid.');
		throw new Error('The credential service is unavailable. Try again later.');
	}
}
