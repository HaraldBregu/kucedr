import type { CatalogService } from './provider_types';

export function findCatalogMcpService(
	url: string,
	services: readonly CatalogService[]
): CatalogService | undefined {
	try {
		const target = new URL(url);
		if (target.username || target.password) return undefined;
		return services.find((service) => {
			if (!service.url || !URL.canParse(service.url)) return false;
			const entry = new URL(service.url);
			return (
				target.origin === entry.origin &&
				target.pathname.replace(/\/$/, '') === entry.pathname.replace(/\/$/, '')
			);
		});
	} catch {
		return undefined;
	}
}
