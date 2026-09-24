import React from 'react';
import { PlugZap } from 'lucide-react';
import type { McpServerInfo } from '@shared/mcp_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import { mcps } from '@/lib/providers';

export function McpServerRow({
	server,
	onOpen,
	onEnabledChange,
	saving,
}: {
	readonly server: McpServerInfo;
	readonly onOpen: () => void;
	readonly onEnabledChange: (enabled: boolean) => Promise<void>;
	readonly saving: boolean;
}): React.JSX.Element {
	const title = server.data.name ?? server.id;
	const description =
		server.data.type === 'http'
			? server.data.url
			: [server.data.command, ...(server.data.args ?? [])].join(' ');
	const service = mcps().find(
		(service) =>
			service.id === server.id || (server.data.type === 'http' && service.url === server.data.url)
	);

	return (
		<Item
			variant="ghost"
			size="md"
			className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
		>
			<button
				type="button"
				onClick={onOpen}
				className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				{service ? (
					<ProviderAvatar
						providerId={service.id}
						name={service.name}
						iconDarkUrl={service.iconDarkUrl}
						iconLightUrl={service.iconLightUrl}
						className="size-9 rounded-2xl border-0 bg-muted/50 p-1.5 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
					/>
				) : (
					<PlugZap
						className="size-9 shrink-0 rounded-2xl bg-muted/50 p-1.5 text-muted-foreground group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
						aria-hidden="true"
					/>
				)}
				<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
					<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
						{title}
					</ItemTitle>
					<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
						{description}
					</p>
				</ItemContent>
			</button>
			<ItemActions className="ml-auto flex-none justify-end">
				<Switch
					checked={server.data.enabled !== false}
					disabled={saving}
					onCheckedChange={(enabled) => void onEnabledChange(enabled)}
					aria-label={`Enable ${title}`}
				/>
			</ItemActions>
		</Item>
	);
}
