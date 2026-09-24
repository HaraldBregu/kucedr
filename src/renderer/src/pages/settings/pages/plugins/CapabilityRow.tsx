import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CatalogService, CatalogStorage } from '@shared/provider_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';

export default function CapabilityRow({
	kind,
	entry,
	onOpen,
	onAdd,
}: {
	readonly kind: 'database' | 'storage';
	readonly entry: CatalogService | CatalogStorage;
	readonly onOpen: () => void;
	readonly onAdd: () => void;
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
				className="size-9 rounded-2xl border-0 bg-muted/50 p-1.5 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
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
				<Button
					variant="ghost"
					size="icon-sm"
					className="hover:bg-transparent dark:hover:bg-transparent"
					onClick={(event) => {
						event.stopPropagation();
						onAdd();
					}}
					aria-label={t('settings.integrations.add', { name: entry.name })}
				>
					<Plus className="size-4" />
				</Button>
			</ItemActions>
		</Item>
	);
}
