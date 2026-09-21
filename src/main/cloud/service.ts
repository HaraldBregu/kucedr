import type {
	AccountProfile,
	AuthCredentials,
	AuthState,
	SignUpInput,
} from '../../shared/auth_types';
import type {
	AccountProvider,
	AccountSession,
	AccountSessionEvent,
} from './account';
import { DeviceAccountBinding } from './binding';

interface AccountBinding {
	accept(userId: string): boolean;
	clear(): void;
}

export class AuthService {
	private unsubscribeProvider?: () => void;
	private session: AccountSession | null = null;
	private providerSessionVersion = 0;
	private initialized = false;
	private readonly stateListeners = new Set<(state: AuthState) => void>();
	private readonly sessionListeners = new Set<(session: AccountSession | null) => void>();
	private state: AuthState = { status: 'loading', persistence: 'memory' };

	constructor(
		private readonly provider: AccountProvider | null,
		private readonly binding: AccountBinding | undefined = provider
			? new DeviceAccountBinding()
			: undefined
	) {}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		if (!this.provider) {
			this.setState({ status: 'unconfigured', persistence: 'memory' });
			return;
		}
		const restoreVersion = this.providerSessionVersion;
		this.unsubscribeProvider = this.provider.subscribe((event, session) => {
			this.providerSessionVersion += 1;
			this.applySession(event, session);
		});
		try {
			const session = await this.provider.restore();
			if (this.providerSessionVersion === restoreVersion) {
				this.applySession('session', session);
			}
		} catch {
			if (this.providerSessionVersion === restoreVersion) {
				this.applySession('session', null);
			}
		}
	}

	getState(): AuthState {
		return structuredClone(this.state);
	}

	getAccessToken(): string | null {
		return this.state.status === 'signedIn' ? (this.session?.accessToken ?? null) : null;
	}

	getSignedInUserId(): string | undefined {
		return this.state.status === 'signedIn' ? this.session?.user.id : undefined;
	}

	async getProfile(): Promise<AccountProfile> {
		return this.accountProvider().getProfile(this.requireSignedInUserId());
	}

	async updateProfile(profile: AccountProfile): Promise<AccountProfile> {
		return this.accountProvider().updateProfile(this.requireSignedInUserId(), profile);
	}

	onStateChanged(listener: (state: AuthState) => void): () => void {
		this.stateListeners.add(listener);
		return () => this.stateListeners.delete(listener);
	}

	onSessionChanged(listener: (session: AccountSession | null) => void): () => void {
		this.sessionListeners.add(listener);
		return () => this.sessionListeners.delete(listener);
	}

	async signIn(credentials: AuthCredentials): Promise<AuthState> {
		this.applySession('session', await this.accountProvider().signIn(credentials));
		if (this.state.status !== 'signedIn') throw this.accountMismatchError();
		return this.getState();
	}

	signInWithGoogle(): Promise<string> {
		if (this.state.error) {
			const { error: _error, ...state } = this.state;
			this.setState(state);
		}
		return this.accountProvider().signInWithGoogle();
	}

	async signUp(input: SignUpInput): Promise<AuthState> {
		const session = await this.accountProvider().signUp(input);
		if (session) {
			this.applySession('session', session);
			if (this.state.status !== 'signedIn') throw this.accountMismatchError();
		} else {
			this.setState({
				status: 'confirmationRequired',
				email: input.email,
				persistence: this.persistence(),
			});
		}
		return this.getState();
	}

	resendConfirmation(email: string): Promise<void> {
		return this.accountProvider().resendConfirmation(email);
	}

	requestPasswordReset(email: string): Promise<void> {
		return this.accountProvider().requestPasswordReset(email);
	}

	async updatePassword(password: string): Promise<AuthState> {
		if (!this.session) throw new Error('The recovery session has expired.');
		const user = await this.accountProvider().updatePassword(password);
		this.applySession('session', { ...this.session, user });
		return this.getState();
	}

	async signOut(): Promise<AuthState> {
		if (this.provider) await this.provider.signOut();
		this.binding?.clear();
		this.applySession('session', null);
		return this.getState();
	}

	async handleDeepLink(value: string): Promise<AuthState> {
		try {
			const url = new URL(value);
			if (url.protocol !== 'kucedr:' || url.hostname !== 'auth' || url.pathname !== '/callback') {
				throw new Error('The authentication link is invalid.');
			}
			if (url.searchParams.has('error')) throw new Error('The authentication link was rejected.');
			const code = url.searchParams.get('code');
			if (!code || code.length > 2048) throw new Error('The authentication link has expired.');
			const session = await this.accountProvider().exchangeCode(code);
			const recovery =
				url.searchParams.get('type') === 'recovery' || this.state.status === 'recovery';
			this.applySession(recovery ? 'recovery' : 'session', session);
			if (this.state.status !== (recovery ? 'recovery' : 'signedIn')) {
				throw this.accountMismatchError();
			}
			return this.getState();
		} catch (cause) {
			const error =
				cause instanceof Error && cause.name === 'AccountMismatchError'
					? this.accountMismatchError().message
					: 'Sign-in could not be completed. Please try again.';
			this.setState({ ...this.state, error });
			throw new Error(error);
		}
	}

	destroy(): void {
		this.unsubscribeProvider?.();
		this.unsubscribeProvider = undefined;
		this.provider?.destroy();
		this.stateListeners.clear();
		this.sessionListeners.clear();
	}

	private applySession(event: AccountSessionEvent, session: AccountSession | null): void {
		if (session && !this.binding?.accept(session.user.id)) {
			this.session = null;
			this.sessionListeners.forEach((listener) => listener(null));
			this.setState({ status: 'signedOut', persistence: this.persistence() });
			queueMicrotask(() => void this.provider?.signOut().catch(() => undefined));
			return;
		}
		this.session = session;
		this.sessionListeners.forEach((listener) => listener(session));
		if (!session) {
			this.setState({ status: 'signedOut', persistence: this.persistence() });
			return;
		}
		this.setState({
			status: event === 'recovery' ? 'recovery' : 'signedIn',
			persistence: this.persistence(),
			user: structuredClone(session.user),
		});
	}

	private accountProvider(): AccountProvider {
		if (!this.provider) throw new Error('Kucedr account services are unavailable.');
		return this.provider;
	}

	private requireSignedInUserId(): string {
		const userId = this.getSignedInUserId();
		if (!userId) throw new Error('Sign in to manage your account.');
		return userId;
	}

	private persistence(): 'encrypted' | 'memory' {
		return this.provider?.persistence ?? 'memory';
	}

	private setState(state: AuthState): void {
		this.state = state;
		this.stateListeners.forEach((listener) => listener(this.getState()));
	}

	private accountMismatchError(): Error {
		const error = new Error(
			'This local Kucedr profile belongs to another account. Use that account or a separate operating-system profile.'
		);
		error.name = 'AccountMismatchError';
		return error;
	}
}
