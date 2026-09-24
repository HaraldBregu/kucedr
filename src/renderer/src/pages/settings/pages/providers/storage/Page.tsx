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
import { ProviderAvatar } from '@/components/provider-avatar';
import { storages } from '@/lib/providers';
import type { StorageProvider } from '@shared/storage_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
} from '../../../components';
import StorageForm from './Form';

export default function StorageProvidersPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [providers, setProviders] = useState<StorageProvider[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [editing, setEditing] = useState<StorageProvider | 'new' | null>(null);
	const [removing, setRemoving] = useState<string | null>(null);
	const [enabledPresetIds, setEnabledPresetIds] = useState<readonly string[]>([]);
	const [selectedPresetId, setSelectedPresetId] = useState<string>();
	const enabledStorages = storages().filter((entry) =>
		enabledPresetIds.includes(`${entry.provider.id}/${entry.id}`)
	);

	useEffect(() => {
		let cancelled = false;
		void window.provider.listEnabledPlugins().then((enabled) => {
			if (!cancelled) setEnabledPresetIds(enabled.storage);
		});
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
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.storage')}
				description={t('settings.storageProviders.description')}
				action={
					<Button
						size="sm"
						disabled={
							loading || removing !== null || editing !== null || enabledStorages.length === 0
						}
						onClick={() => {
							setSelectedPresetId(undefined);
							setEditing('new');
						}}
					>
						<Plus className="size-3.5" />
						{t('settings.storageProviders.add')}
					</Button>
				}
			/>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{editing !== null && (
				<StorageForm
					enabledPresetIds={enabledPresetIds}
					initialPresetId={selectedPresetId}
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
			{(loading || providers.length > 0 || (editing === null && !error)) && (
				<div className="-mx-4 grid grid-cols-1 gap-y-3 pb-4">
					{loading ? (
						<SettingsLoadingRows />
					) : (
						<>
							{enabledStorages.map((storage) => (
								<Item
									key={`${storage.provider.id}/${storage.id}`}
									variant="ghost"
									size="md"
									className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2"
								>
									<ProviderAvatar
										providerId={storage.provider.id}
										name={storage.name}
										iconDarkUrl={storage.provider.iconDarkUrl}
										iconLightUrl={storage.provider.iconLightUrl}
										className="size-10 rounded-2xl border-0 bg-muted/50 p-1"
									/>
									<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
										<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
											{storage.name}
										</ItemTitle>
										{storage.description && (
											<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
												{storage.description}
											</p>
										)}
									</ItemContent>
									<ItemActions className="ml-auto flex-none justify-end">
										<Button
											variant="outline"
											size="sm"
											disabled={removing !== null || editing !== null}
											onClick={() => {
												setSelectedPresetId(storage.id);
												setEditing('new');
											}}
										>
											{t('settings.integrations.add', { name: storage.name })}
										</Button>
									</ItemActions>
								</Item>
							))}
							{providers.length === 0
								? !error &&
									editing === null && (
										<SettingsEmptyState
											icon={HardDrive}
											title={t('settings.storageProviders.emptyTitle')}
											description={t('settings.storageProviders.emptyDescription')}
										/>
									)
								: providers.map((provider) => (
										<Item
											key={provider.id}
											variant="ghost"
											size="md"
											className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
										>
											<HardDrive
												className="size-10 shrink-0 rounded-2xl bg-muted/50 p-1 text-muted-foreground group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
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
															className="hover:bg-transparent dark:hover:bg-transparent"
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
																		setError(
																			getErrorMessage(
																				err,
																				t('settings.storageProviders.removeError')
																			)
																		);
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
									))}
						</>
					)}
				</div>
			)}
		</SettingsPageShell>
	);
}
