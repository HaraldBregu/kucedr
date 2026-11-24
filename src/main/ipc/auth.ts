import type { AccountProfile, AuthCredentials, SignUpInput } from '../../shared/auth_types';
import { AuthChannels } from '../../shared/ipc_channels_definitions';
import type { AuthService } from '../cloud/service';
import type { AppRegistry } from '../apps/app_registry';
import type { EventBus } from '../event_bus';
import { openExternal } from '../handoff';
import { requireUnrestrictedNetwork } from '../privacy/state';
import type { WindowContextManager } from '../window_context';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface AuthIpcDeps {
	auth: AuthService;
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class AuthIpc implements IpcModule<AuthIpcDeps> {
	readonly name = 'auth';

	register({ auth, windows, apps }: AuthIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		auth.onStateChanged((state) => trusted.broadcast(AuthChannels.stateChanged, state));
		registerQueryWithEvent(AuthChannels.getState, (event) => {
			trusted.assert(event);
			return auth.getState();
		});
		registerQueryWithEvent(AuthChannels.getProfile, (event) => {
			trusted.assert(event);
			return auth.getProfile();
		});
		registerCommandWithEvent(AuthChannels.updateProfile, (event, value) => {
			trusted.assert(event);
			return auth.updateProfile(this.profile(value));
		});
		registerCommandWithEvent(AuthChannels.signIn, (event, value) => {
			trusted.assert(event);
			return auth.signIn(this.credentials(value));
		});
		registerCommandWithEvent(AuthChannels.signInWithGoogle, async (event) => {
			trusted.assert(event);
			requireUnrestrictedNetwork();
			await openExternal(await auth.signInWithGoogle());
		});
		registerCommandWithEvent(AuthChannels.signUp, (event, value) => {
			trusted.assert(event);
			return auth.signUp(this.signUp(value));
		});
		registerCommandWithEvent(AuthChannels.resendConfirmation, (event, value) => {
			trusted.assert(event);
			return auth.resendConfirmation(this.email(value));
		});
		registerCommandWithEvent(AuthChannels.requestPasswordReset, (event, value) => {
			trusted.assert(event);
			return auth.requestPasswordReset(this.email(value));
		});
		registerCommandWithEvent(AuthChannels.updatePassword, (event, value) => {
			trusted.assert(event);
			return auth.updatePassword(this.newPassword(value));
		});
		registerCommandWithEvent(AuthChannels.signOut, (event) => {
			trusted.assert(event);
			return auth.signOut();
		});
	}

	private credentials(value: unknown): AuthCredentials {
		const record = this.record(value);
		return { email: this.email(record.email), password: this.currentPassword(record.password) };
	}

	private signUp(value: unknown): SignUpInput {
		const record = this.record(value);
		const credentials = {
			email: this.email(record.email),
			password: this.newPassword(record.password),
		};
		if (record.displayName === undefined) return credentials;
		if (typeof record.displayName !== 'string' || record.displayName.trim().length > 80) {
			throw new Error('Display name is invalid.');
		}
		return { ...credentials, displayName: record.displayName.trim() || undefined };
	}

	private profile(value: unknown): AccountProfile {
		const record = this.record(value);
		return {
			firstName: this.profileName(record.firstName, 'First name'),
			lastName: this.profileName(record.lastName, 'Last name'),
		};
	}

	private record(value: unknown): Record<string, unknown> {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error('Authentication input is invalid.');
		}
		return value as Record<string, unknown>;
	}

	private email(value: unknown): string {
		if (
			typeof value !== 'string' ||
			value.length > 254 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
		) {
			throw new Error('Enter a valid email address.');
		}
		return value.trim().toLowerCase();
	}

	private currentPassword(value: unknown): string {
		if (typeof value !== 'string' || value.length === 0) {
			throw new Error('Password is required.');
		}
		return value;
	}

	private newPassword(value: unknown): string {
		if (typeof value !== 'string' || value.length < 8 || value.length > 1024) {
			throw new Error('Password must contain at least eight characters.');
		}
		return value;
	}

	private profileName(value: unknown, label: string): string {
		if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
		if (value.trim().length > 80) throw new Error(`${label} must be 80 characters or fewer.`);
		return value.trim();
	}
}
