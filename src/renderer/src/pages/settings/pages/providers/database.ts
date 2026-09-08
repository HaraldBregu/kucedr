import { databaseProviders, databases } from '@/lib/providers';
import { getProviderApiConfigurationUrl } from '@shared/provider_types';
import type { ProviderCatalogItem } from '../../../start/setupTypes';

export function databaseCatalog(): readonly ProviderCatalogItem[] {
	return databaseProviders().map((provider) => ({
		id: provider.id,
		name: provider.name,
		capabilities: databases()
			.filter((entry) => entry.provider.id === provider.id)
			.map((entry) => entry.name)
			.join(' - '),
		supported: true,
		apiConfigurationUrl: getProviderApiConfigurationUrl(provider),
		iconDarkUrl: provider.iconDarkUrl,
		iconLightUrl: provider.iconLightUrl,
	}));
}
