import React, { useEffect, useState } from 'react';
import type { McpData } from '@shared/mcp_types';
import type { CatalogService } from '@shared/provider_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { CustomMcpCard } from '../mcp/components/CustomMcpCard';

function manifestMcp(service: CatalogService): McpData {
	return {
		type: 'http',
		name: service.name,
		url: service.url ?? '',
		enabled: true,
	};
}

export function McpCard({ service }: { readonly service: CatalogService }): React.JSX.Element {
	const [server, setServer] = useState<McpData | null>(null);

	useEffect(() => {
		let cancelled = false;
		void window.mcp.list().then((servers) => {
			if (!cancelled) setServer(servers[service.id] ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, [service.id]);

	const save = async (id: string, entry: McpData): Promise<void> => {
		await window.mcp.upsert(id, entry);
		setServer(entry);
	};

	return (
		<CustomMcpCard
			id={service.id}
			entry={server ?? manifestMcp(service)}
			onSave={save}
			icon={
				<ProviderAvatar
					providerId={service.id}
					name={service.name}
					iconDarkUrl={service.iconDarkUrl}
					iconLightUrl={service.iconLightUrl}
				/>
			}
		/>
	);
}
