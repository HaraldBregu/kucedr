import { databaseProviders, databases } from '@/lib/providers';
import { getProviderApiConfigurationUrl } from '@shared/provider_types';
import type { ProviderCatalogItem } from '../../../start/setupTypes';

export function databaseCatalog(enabledIds?: readonly string[]): readonly ProviderCatalogItem[] {
	return databaseProviders()
		.filter((provider) => enabledIds === undefined || databases().some((entry) =>
			entry.provider.id === provider.id && enabledIds.includes(`${entry.provider.id}/${entry.id}`)
		))
		.map((provider) => ({
		id: provider.id,
		name: provider.name,
		capabilities: databases()
			.filter((entry) => entry.provider.id === provider.id)
			.map((entry) => `${entry.name} (${entry.type})`)
			.join(' - '),
		supported: true,
		apiConfigurationUrl: getProviderApiConfigurationUrl(provider),
		iconDarkUrl: provider.iconDarkUrl,
		iconLightUrl: provider.iconLightUrl,
	}));
}
