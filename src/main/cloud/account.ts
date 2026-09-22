import type {
	AccountProfile,
	AuthCredentials,
	SignUpInput,
} from '../../shared/auth_types';

export interface AccountUser {
	id: string;
	email: string;
	displayName?: string;
	avatarPath?: string;
}

export interface AccountSession {
	accessToken: string;
	user: AccountUser;
}

export type AccountSessionEvent = 'session' | 'recovery';

export interface AccountProvider {
	readonly persistence: 'encrypted' | 'memory';
	subscribe(
		listener: (event: AccountSessionEvent, session: AccountSession | null) => void
	): () => void;
	restore(): Promise<AccountSession | null>;
	getProfile(userId: string): Promise<AccountProfile>;
	updateProfile(userId: string, profile: AccountProfile): Promise<AccountProfile>;
	signIn(credentials: AuthCredentials): Promise<AccountSession>;
	signInWithGoogle(): Promise<string>;
	signUp(input: SignUpInput): Promise<AccountSession | null>;
	resendConfirmation(email: string): Promise<void>;
	requestPasswordReset(email: string): Promise<void>;
	updatePassword(password: string): Promise<AccountUser>;
	signOut(): Promise<void>;
	exchangeCode(code: string): Promise<AccountSession>;
	destroy(): void;
}
