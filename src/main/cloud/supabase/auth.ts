import {
	type AuthChangeEvent,
	type Session,
	type SupabaseClient,
	type User,
} from '@supabase/supabase-js';
import type { AccountProfile, AuthCredentials, SignUpInput } from '../../../shared/auth_types';
import type { AccountProvider, AccountSession, AccountSessionEvent, AccountUser } from '../account';
import type { CloudConfig } from '../config';
import { publicCloudError } from '../cloud_error';
import { publicAuthError } from '../error';
import type { AuthStorage } from '../session';

interface ProfileRow {
	first_name: string | null;
	last_name: string | null;
}

export class SupabaseAccountProvider implements AccountProvider {
	constructor(
		private readonly client: SupabaseClient,
		private readonly config: CloudConfig,
		private readonly storage: AuthStorage
	) {}

	get persistence(): 'encrypted' | 'memory' {
		return this.storage.persistence;
	}

	subscribe(
		listener: (event: AccountSessionEvent, session: AccountSession | null) => void
	): () => void {
		const subscription = this.client.auth.onAuthStateChange((event, session) => {
			listener(this.event(event), session ? this.session(session) : null);
		}).data.subscription;
		return () => subscription.unsubscribe();
	}

	async restore(): Promise<AccountSession | null> {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			const result = await Promise.race([
				this.client.auth.getSession(),
				new Promise<null>((resolve) => {
					timeout = setTimeout(() => resolve(null), 10_000);
				}),
			]);
			if (!result || result.error || !result.data.session) return null;
			return this.session(result.data.session);
		} finally {
			if (timeout) clearTimeout(timeout);
		}
	}

	async getProfile(userId: string): Promise<AccountProfile> {
		const { data, error } = await this.client
			.from('profiles')
			.select('first_name,last_name')
			.eq('id', userId)
			.maybeSingle();
		if (error) throw publicCloudError(error);
		const profile = data as ProfileRow | null;
		return { firstName: profile?.first_name ?? '', lastName: profile?.last_name ?? '' };
	}

	async updateProfile(userId: string, profile: AccountProfile): Promise<AccountProfile> {
		const { data, error } = await this.client
			.from('profiles')
			.update({ first_name: profile.firstName, last_name: profile.lastName })
			.eq('id', userId)
			.select('first_name,last_name')
			.single();
		if (error) throw publicCloudError(error);
		const saved = data as ProfileRow;
		return { firstName: saved.first_name, lastName: saved.last_name };
	}

	async signIn(credentials: AuthCredentials): Promise<AccountSession> {
		const { data, error } = await this.client.auth.signInWithPassword(credentials);
		if (error) throw publicAuthError(error);
		return this.session(data.session);
	}

	async signInWithGoogle(): Promise<string> {
		const { data, error } = await this.client.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: this.config.redirectUrl,
				skipBrowserRedirect: true,
			},
		});
		if (error) throw publicAuthError(error);
		const url = new URL(data.url);
		if (
			url.origin !== this.config.url ||
			url.pathname !== '/auth/v1/authorize' ||
			url.username ||
			url.password
		) {
			throw new Error('The account service returned an invalid sign-in URL.');
		}
		return url.toString();
	}

	async signUp(input: SignUpInput): Promise<AccountSession | null> {
		const { email, password, displayName } = input;
		const { data, error } = await this.client.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: this.config.redirectUrl,
				data: displayName ? { display_name: displayName } : undefined,
			},
		});
		if (error) throw publicAuthError(error);
		return data.session ? this.session(data.session) : null;
	}

	async resendConfirmation(email: string): Promise<void> {
		const { error } = await this.client.auth.resend({
			type: 'signup',
			email,
			options: { emailRedirectTo: this.config.redirectUrl },
		});
		if (error) throw publicAuthError(error);
	}

	async requestPasswordReset(email: string): Promise<void> {
		const { error } = await this.client.auth.resetPasswordForEmail(email, {
			redirectTo: this.config.redirectUrl,
		});
		if (error) throw publicAuthError(error);
	}

	async updatePassword(password: string): Promise<AccountUser> {
		const { data, error } = await this.client.auth.updateUser({ password });
		if (error) throw publicAuthError(error);
		return this.user(data.user);
	}

	async signOut(): Promise<void> {
		const { error } = await this.client.auth.signOut({ scope: 'local' });
		if (error) throw publicAuthError(error);
	}

	async exchangeCode(code: string): Promise<AccountSession> {
		const { data, error } = await this.client.auth.exchangeCodeForSession(code);
		if (error) throw publicAuthError(error);
		return this.session(data.session);
	}

	destroy(): void {
		this.client.auth.stopAutoRefresh();
	}

	private event(event: AuthChangeEvent): AccountSessionEvent {
		return event === 'PASSWORD_RECOVERY' ? 'recovery' : 'session';
	}

	private session(session: Session): AccountSession {
		return { accessToken: session.access_token, user: this.user(session.user) };
	}

	private user(user: User): AccountUser {
		const displayName = user.user_metadata.display_name;
		const avatarPath = user.user_metadata.avatar_path;
		return {
			id: user.id,
			email: user.email ?? '',
			...(typeof displayName === 'string' ? { displayName } : {}),
			...(typeof avatarPath === 'string' ? { avatarPath } : {}),
		};
	}
}
