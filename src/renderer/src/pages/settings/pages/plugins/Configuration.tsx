import { useEffect, useState } from 'react';
import { AlertTriangle, HardDrive, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import type { CatalogStorage } from '@shared/provider_types';
import type { StorageProvider } from '@shared/storage_types';
import { getErrorMessage } from '../../../start/setupConstants';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsSection,
} from '../../components';
import StorageForm from './StorageForm';

interface ConfigurationProps {
	readonly storage: CatalogStorage;
}

export default function Configuration({ storage }: ConfigurationProps): React.JSX.Element {
	const { t } = useTranslation();
	const [providers, setProviders] = useState<StorageProvider[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [editing, setEditing] = useState<StorageProvider | 'new' | null>(null);
	const [removing, setRemoving] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void window.storage.listProviders().then(
			(saved) => {
				if (!cancelled) {
					setProviders(saved);
					setLoading(false);
				}
			},
			(err: unknown) => {
				if (!cancelled) {
					setError(getErrorMessage(err, t('settings.storageProviders.loadError')));
					setLoading(false);
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [t]);

	return (
		<SettingsSection
			title={t('settings.integrations.plugin.configuration', { name: storage.name })}
			description={t('settings.storageProviders.description')}
			action={
				<Button
					size="sm"
					disabled={loading || removing !== null || editing !== null}
					onClick={() => setEditing('new')}
				>
					<Plus className="size-3.5" />
					{t('settings.storageProviders.add')}
				</Button>
			}
		>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{editing !== null && (
				<StorageForm
					enabledPresetIds={[`${storage.provider.id}/${storage.id}`]}
					initialPresetId={storage.id}
					provider={editing === 'new' ? undefined : editing}
					onCancel={() => setEditing(null)}
					onSaved={(saved) => {
						setProviders((current) =>
							current.some((entry) => entry.id === saved.id)
								? current.map((entry) => (entry.id === saved.id ? saved : entry))
								: [...current, saved]
						);
						setError('');
						setEditing(null);
					}}
				/>
			)}
			<div className="-mx-4 grid grid-cols-1 gap-y-3">
				{loading ? (
					<SettingsLoadingRows />
				) : providers.length === 0 ? (
					editing === null && (
						<SettingsEmptyState
							icon={HardDrive}
							title={t('settings.storageProviders.emptyTitle')}
							description={t('settings.storageProviders.emptyDescription')}
						/>
					)
				) : (
					providers.map((provider) => (
						<Item
							key={provider.id}
							variant="ghost"
							size="md"
							className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
						>
							<HardDrive
								className="size-10 shrink-0 rounded-2xl border-0 bg-muted/50 p-2.5 text-muted-foreground"
								aria-hidden="true"
							/>
							<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
								<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
									{provider.name}
								</ItemTitle>
								<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
									{provider.bucket} · {provider.region}
								</p>
							</ItemContent>
							<ItemActions className="ml-auto flex-none justify-end">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											disabled={removing !== null || editing !== null}
											aria-label={`Options for ${provider.name}`}
										>
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => setEditing(provider)}>
											<Pencil />
											{t('settings.storageProviders.edit', { name: provider.name })}
										</DropdownMenuItem>
										<DropdownMenuItem
											onSelect={() => {
												setRemoving(provider.id);
												setError('');
												void window.storage
													.removeProvider(provider.id)
													.then(() => {
														setProviders((current) =>
															current.filter((entry) => entry.id !== provider.id)
														);
													})
													.catch((err: unknown) => {
														setError(getErrorMessage(err, t('settings.storageProviders.removeError')));
													})
													.finally(() => setRemoving(null));
											}}
										>
											<Trash2 />
											{t('settings.storageProviders.remove', { name: provider.name })}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</ItemActions>
						</Item>
					))
				)}
			</div>
		</SettingsSection>
	);
}
