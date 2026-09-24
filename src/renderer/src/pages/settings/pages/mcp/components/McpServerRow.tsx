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
import { MICROSOFT_365_SERVICES } from '../../plugins/Microsoft';

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
	const description =
		server.data.type === 'http'
			? server.data.url
			: [server.data.command, ...(server.data.args ?? [])].join(' ');
	const service = mcps().find(
		(service) =>
			service.id === server.id || (server.data.type === 'http' && service.url === server.data.url)
	);
	const iconService =
		service ??
		(MICROSOFT_365_SERVICES.some((entry) => entry.id === server.id)
			? mcps().find((entry) => entry.id === 'microsoft-learn')
			: undefined);

	return (
		<Item
			variant="ghost"
			size="md"
			className="relative min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50 md:col-start-1"
		>
			<ProviderAvatar
				providerId={iconService?.id ?? server.id}
				name={iconService?.name ?? title}
				iconDarkUrl={iconService?.iconDarkUrl}
				iconLightUrl={iconService?.iconLightUrl}
				className="size-9 rounded-2xl border-0 bg-muted/50 p-1.5 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
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
