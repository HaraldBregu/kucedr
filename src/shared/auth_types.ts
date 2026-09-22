export type AuthStatus =
	'loading' | 'unconfigured' | 'signedOut' | 'confirmationRequired' | 'signedIn' | 'recovery';

export interface AuthUser {
	id: string;
	email: string;
	displayName?: string;
	avatarPath?: string;
}

export interface AuthState {
	error?: string;
	status: AuthStatus;
	user?: AuthUser;
	email?: string;
	persistence: 'encrypted' | 'memory';
}

export interface AuthCredentials {
	email: string;
	password: string;
}

export interface SignUpInput extends AuthCredentials {
	displayName?: string;
}

export interface AccountProfile {
	firstName: string;
	lastName: string;
}

export interface AuthApi {
	getState: () => Promise<AuthState>;
	getProfile: () => Promise<AccountProfile>;
	updateProfile: (profile: AccountProfile) => Promise<AccountProfile>;
	signIn: (credentials: AuthCredentials) => Promise<AuthState>;
	signInWithGoogle: () => Promise<void>;
	signUp: (input: SignUpInput) => Promise<AuthState>;
	resendConfirmation: (email: string) => Promise<void>;
	requestPasswordReset: (email: string) => Promise<void>;
	updatePassword: (password: string) => Promise<AuthState>;
	signOut: () => Promise<AuthState>;
	onStateChanged: (callback: (state: AuthState) => void) => () => void;
}
