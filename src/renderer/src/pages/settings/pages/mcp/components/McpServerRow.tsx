import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { McpServerInfo } from '@shared/mcp_types';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';

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

	return (
		<Item
			as="button"
			type="button"
			variant="ghost"
			size="md"
			onClick={onOpen}
			className="cursor-pointer px-0 py-3.5 text-left hover:bg-muted/50"
		>
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
