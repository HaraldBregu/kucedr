import {
	CLOUD_CREDENTIAL_SERVICES,
	type CloudCredentialInput,
} from '../../shared/credential_types';
import { CredentialChannels } from '../../shared/ipc_channels_definitions';
import { getCredentialId, getProviderId, setCredentialId } from '../agent/agent_store';
import type { AppRegistry } from '../apps/app_registry';
import type { CredentialMigration } from '../credentials/migration';
import type { CredentialService } from '../credentials/service';
import type { EventBus } from '../event_bus';
import type { WindowContextManager } from '../window_context';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface CredentialIpcDeps {
	credentials: CredentialService;
	migration: CredentialMigration;
	windows: WindowContextManager;
	apps: AppRegistry;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CredentialIpc implements IpcModule<CredentialIpcDeps> {
	readonly name = 'credentials';

	register({ credentials, migration, windows, apps }: CredentialIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		trusted.query(CredentialChannels.list, () => credentials.list());
		trusted.command(CredentialChannels.create, (input) => credentials.create(this.input(input)));
		trusted.command(CredentialChannels.replace, (id, secret) =>
			credentials.replace(this.id(id), this.secret(secret))
		);
		trusted.command(CredentialChannels.rename, (id, label) =>
			credentials.rename(this.id(id), this.label(label))
		);
		trusted.command(CredentialChannels.test, (id) => credentials.test(this.id(id)));
		trusted.command(CredentialChannels.remove, async (id) => {
			const credentialId = this.id(id);
			await credentials.remove(credentialId);
			selection.clear(credentialId);
		});
		trusted.query(CredentialChannels.active, () => selection.all());
		trusted.command(CredentialChannels.activate, async (service, id) => {
			if (!(CLOUD_CREDENTIAL_SERVICES as readonly unknown[]).includes(service))
				throw new Error('This plugin does not support cloud API keys.');
			if (id === null) return selection.set(service, undefined);
			const credentialId = this.id(id);
			const owned = await credentials.list();
			if (!owned.some((entry) => entry.id === credentialId && entry.service === service))
				throw new Error('This API key no longer exists.');
			selection.set(service, credentialId);
		});
		trusted.query(CredentialChannels.listLocal, () => migration.listLocal());
		trusted.command(CredentialChannels.migrate, (localIds) => {
			if (!Array.isArray(localIds) || localIds.length === 0 || localIds.length > 50)
				throw new Error('Choose the local API keys to upload.');
			return migration.migrate(localIds.map((localId) => this.localId(localId)));
		});
		trusted.command(CredentialChannels.removeLocal, async (localId) => {
			const id = this.localId(localId);
			const credentialId = await migration.removeLocal(id);
			if (!selection.get(id)) selection.set(id, credentialId);
		});
	}

	private input(value: unknown): CloudCredentialInput {
		if (!value || typeof value !== 'object' || Array.isArray(value))
			throw new Error('The API key details are invalid.');
		const record = value as Record<string, unknown>;
		if (!(CLOUD_CREDENTIAL_SERVICES as readonly unknown[]).includes(record.service))
			throw new Error('This service does not support cloud API keys.');
		return {
			service: record.service as CloudCredentialInput['service'],
			label: this.label(record.label),
			secret: this.secret(record.secret),
		};
	}

	private id(value: unknown): string {
		if (typeof value !== 'string' || !UUID.test(value)) throw new Error('The API key is invalid.');
		return value.toLowerCase();
	}

	private localId(value: unknown): string {
		if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(value))
			throw new Error('The local API key is invalid.');
		return value;
	}

	private label(value: unknown): string {
		const label = typeof value === 'string' ? value.trim() : '';
		if (!label || label.length > 100) throw new Error('Enter a name of up to 100 characters.');
		return label;
	}

	private secret(value: unknown): string {
		const secret = typeof value === 'string' ? value.trim() : '';
		if (secret.length < 8 || secret.length > 16_384 || /\s/.test(secret))
			throw new Error('The API key is invalid.');
		return secret;
	}
}
