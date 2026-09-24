import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CatalogService, CatalogStorage } from '@shared/provider_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';

export default function CapabilityRow({
	kind,
	entry,
	onOpen,
	onAdd,
	onRemove,
	enabled,
	saving,
}: {
	readonly kind: 'database' | 'storage';
	readonly entry: CatalogService | CatalogStorage;
	readonly onOpen: () => void;
	readonly onAdd: () => void;
	readonly onRemove: () => void;
	readonly enabled: boolean;
	readonly saving: boolean;
}): React.JSX.Element {
	const { t } = useTranslation();
	const description =
		entry.description ??
		(kind === 'database' && 'type' in entry
			? t('settings.integrations.databaseType', { type: entry.type })
			: t('settings.integrations.storageType'));

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
				providerId={entry.provider.id}
				name={entry.name}
				iconDarkUrl={entry.provider.iconDarkUrl}
				iconLightUrl={entry.provider.iconLightUrl}
				className="size-10 rounded-2xl border-0 bg-muted/50 p-1 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
			/>
			<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
				<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
					{entry.name}
				</ItemTitle>
				<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
					{description}
				</p>
			</ItemContent>
			<ItemActions className="ml-auto flex-none justify-end">
				{enabled ? <DropdownMenu>
					<DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={saving} onClick={(event) => event.stopPropagation()} aria-label={t('settings.integrations.options', { name: entry.name })}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
					<DropdownMenuContent align="end"><DropdownMenuItem onSelect={onRemove}><Trash2 />{t('settings.integrations.remove', { name: entry.name })}</DropdownMenuItem></DropdownMenuContent>
				</DropdownMenu> : <Button
					variant="ghost"
					size="icon-sm"
					disabled={saving}
					className="hover:bg-transparent dark:hover:bg-transparent"
					onClick={(event) => {
						event.stopPropagation();
						onAdd();
					}}
					aria-label={t('settings.integrations.add', { name: entry.name })}
				>
					<Plus className="size-4" />
				</Button>}
			</ItemActions>
		</Item>
	);
}
