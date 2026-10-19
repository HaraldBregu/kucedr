import type { PluginManifest } from '../../shared/plugin_manifest';
import type { ProviderManifest } from '../../shared/provider_types';
import { validateProviderManifest } from '../../shared/providers/validation';

/** The provider a plugin defines with provider fields (services, authentication, icons) in its manifest. */
export function pluginProvider(manifest: PluginManifest): ProviderManifest | undefined {
	const {
		schemaVersion: _schemaVersion,
		id,
		title,
		version: _version,
		description: _description,
		author: _author,
		minAppVersion: _minAppVersion,
		icon: _icon,
		...fields
	} = manifest;
	if (Object.keys(fields).length === 0) return undefined;
	const provider = { providerId: id, providerName: title, ...fields };
	const errors = validateProviderManifest(provider);
	if (errors.length > 0) throw new Error(errors.join(' '));
	return provider as ProviderManifest;
}
