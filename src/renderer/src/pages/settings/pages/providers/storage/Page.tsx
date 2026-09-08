import { useEffect, useState } from 'react';
import { AlertTriangle, HardDrive, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { StorageProvider } from '@shared/storage_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
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
			<SettingsPanel>
				{loading ? (
					<SettingsLoadingRows />
				) : providers.length === 0 ? (
					!error && (
						<SettingsEmptyState
							icon={HardDrive}
							title={t('settings.storageProviders.emptyTitle')}
							description={t('settings.storageProviders.emptyDescription')}
						/>
					)
				) : (
					providers.map((provider) => (
						<SettingsRow
							key={provider.id}
							icon={HardDrive}
							title={
								<span className="block truncate" title={provider.name}>
									{provider.name}
								</span>
							}
							description={
								<span className="block truncate" title={`${provider.bucket} · ${provider.region}`}>
									{provider.bucket} · {provider.region}
								</span>
							}
							actions={
								<>
									<Button
										variant="ghost"
										size="icon-sm"
										disabled={removing !== null || editing !== null}
										aria-label={t('settings.storageProviders.edit', { name: provider.name })}
										onClick={() => setEditing(provider)}
									>
										<Pencil className="size-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										disabled={removing !== null || editing !== null}
										className="text-muted-foreground hover:text-destructive"
										aria-label={t('settings.storageProviders.remove', { name: provider.name })}
										onClick={() => {
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
										<Trash2 className="size-3.5" />
									</Button>
								</>
							}
						/>
					))
				)}
			</SettingsPanel>
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
		</SettingsPageShell>
	);
}
