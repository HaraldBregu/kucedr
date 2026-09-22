import React from 'react';
import { ChevronRight, PlugZap } from 'lucide-react';
import type { McpServerInfo } from '@shared/mcp_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { mcps } from '@/lib/providers';

export function McpServerRow({
	server,
	onOpen,
}: {
	readonly server: McpServerInfo;
	readonly onOpen: () => void;
}): React.JSX.Element {
	const title = server.data.name ?? server.id;
	const description =
		server.data.type === 'http'
			? server.data.url
			: [server.data.command, ...(server.data.args ?? [])].join(' ');
	const provider = mcps().find(
		(service) => service.id === server.id || service.url === server.data.url
	)?.provider;

	return (
		<Item
			as="button"
			type="button"
			variant="ghost"
			size="md"
			onClick={onOpen}
			className="cursor-pointer px-0 py-3.5 text-left hover:bg-muted/50"
		>
			{provider ? (
				<ProviderAvatar
					providerId={provider.id}
					name={provider.name}
					iconDarkUrl={provider.iconDarkUrl}
					iconLightUrl={provider.iconLightUrl}
					className="size-8 rounded-none border-0 bg-transparent p-0"
				/>
			) : (
				<PlugZap className="size-8 shrink-0 text-muted-foreground" aria-hidden="true" />
			)}
			<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
				<ItemTitle className="min-w-0 max-w-full truncate text-sm font-semibold leading-tight">
					{title}
				</ItemTitle>
				<p className="max-w-full truncate text-xs font-medium leading-tight text-muted-foreground">
					{description}
				</p>
			</ItemContent>
			<ItemActions className="ml-auto flex-none justify-end">
				<ChevronRight className="size-3.5 text-muted-foreground" />
			</ItemActions>
		</Item>
	);
}
