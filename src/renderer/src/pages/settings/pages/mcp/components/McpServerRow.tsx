import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { McpServerInfo } from '@shared/mcp_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
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
	const enabled = server.data.enabled !== false;
	const service = mcps().find(
		(service) =>
			service.id === server.id || (server.data.type === 'http' && service.url === server.data.url)
	);
	const description =
		service?.description ??
		(server.data.type === 'http' ? 'Remote MCP server.' : 'Local MCP server.');

	return (
		<Item
			variant="ghost"
			size="md"
			className="relative min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
		>
			<ProviderAvatar
				providerId={service?.id ?? server.id}
				name={service?.name ?? title}
				iconDarkUrl={service?.iconDarkUrl}
				iconLightUrl={service?.iconLightUrl}
				className="size-10 rounded-2xl border-0 bg-muted/50 p-1 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
			/>
			<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
				<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
					{title}
				</ItemTitle>
				<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
					{description}
				</p>
			</ItemContent>
			<ItemActions className="relative z-10 ml-auto flex-none justify-end">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							className="hover:bg-transparent dark:hover:bg-transparent"
							disabled={saving}
							aria-label={`Options for ${title}`}
						>
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => void onEnabledChange(!enabled)}>
							{enabled ? 'Disable server' : 'Enable server'}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</ItemActions>
			<button
				type="button"
				onClick={onOpen}
				aria-label={`Open ${title}`}
				className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			/>
		</Item>
	);
}
