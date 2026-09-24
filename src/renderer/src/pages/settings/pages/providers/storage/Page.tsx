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
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.storage')}
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
			/>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{editing !== null && (
				<StorageForm
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
				<div className="-mx-4 grid grid-cols-1 gap-y-1 pb-4">
					{loading ? (
						<SettingsLoadingRows />
					) : providers.length === 0 ? (
						!error &&
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
									className="size-9 shrink-0 rounded-2xl bg-muted/50 p-1.5 text-muted-foreground group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
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
																getErrorMessage(err, t('settings.storageProviders.removeError'))
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
						))
					)}
				</div>
			)}
		</SettingsPageShell>
	);
}
