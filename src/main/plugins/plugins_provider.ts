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
		categories: _categories,
		author: _author,
		website: _website,
		minAppVersion: _minAppVersion,
		icon,
		iconDark,
		settings: _settings,
		...fields
	} = manifest;
	if (Object.keys(fields).length === 0) return undefined;
	const model = Array.isArray(fields.models)
		? fields.models.find((item) => item && typeof item === 'object' && 'modelsUrl' in item) ?? fields.models[0]
		: undefined;
	const modelUrls =
		model && typeof model === 'object' && !Array.isArray(model)
			? (model as Record<string, unknown>)
			: {};
	const provider = {
		providerId: id,
		providerName: title,
		...(icon && {
			icon_light_url: `/assets/${icon}`,
			icon_dark_url: `/assets/${iconDark ?? icon}`,
		}),
		...Object.fromEntries(
			(['apiKeyUrl', 'baseUrl', 'modelsUrl', 'modelUrl'] as const)
				.filter((key) => modelUrls[key] !== undefined)
				.map((key) => [key, modelUrls[key]])
		),
		...fields,
	};
	const errors = validateProviderManifest(provider);
	if (errors.length > 0) throw new Error(errors.join(' '));
	return provider as ProviderManifest;
}
