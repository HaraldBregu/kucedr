import { MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CatalogService } from '@shared/provider_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';

export function ChannelRow({
	service,
	configured,
	onOpen,
}: {
	readonly service: CatalogService;
	readonly configured: boolean;
	readonly onOpen: () => void;
}): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<Item
			role="link"
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
					event.preventDefault();
					onOpen();
				}
			}}
			variant="ghost"
			size="md"
			className="min-w-0 cursor-pointer flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
		>
			<ProviderAvatar
				providerId={service.provider.id}
				name={service.provider.name}
				iconDarkUrl={service.provider.iconDarkUrl}
				iconLightUrl={service.provider.iconLightUrl}
				className="size-10 rounded-2xl border-0 bg-muted/50 p-1 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
			/>
			<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
				<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
					{service.name}
				</ItemTitle>
				<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
					{service.description ?? service.provider.name}
				</p>
			</ItemContent>
			<ItemActions className="ml-auto flex-none justify-end">
				{configured ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={(event) => event.stopPropagation()}
								aria-label={t('settings.integrations.options', { name: service.name })}
							>
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={onOpen}>
								<Pencil />
								{t('settings.channels.editToken')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<Button
						variant="ghost"
						size="icon-sm"
						className="hover:bg-transparent dark:hover:bg-transparent"
						onClick={(event) => {
							event.stopPropagation();
							onOpen();
						}}
						aria-label={t('settings.integrations.add', { name: service.name })}
					>
						<Plus className="size-4" />
					</Button>
				)}
			</ItemActions>
		</Item>
	);
}
