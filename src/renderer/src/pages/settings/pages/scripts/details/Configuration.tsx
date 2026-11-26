import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StorageProvider } from '@shared/storage_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import { SettingsLoadingRows, SettingsNotice, SettingsSection } from '../../../components';
import Portability from '../../../components/Portability';
import StorageForm from './StorageForm';

export default function Configuration(): React.JSX.Element {
	const { t } = useTranslation();
	const [provider, setProvider] = useState<StorageProvider | null>();
	const [vaultEnabled, setVaultEnabled] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		void Promise.all([
			window.storage.listProviders(),
			window.storage.getSettings(),
		]).then(
			([saved, settings]) => {
				if (!cancelled)
					setProvider(saved.find((entry) => entry.id === settings.providerId) ?? saved[0] ?? null);
			},
			(err: unknown) => {
				if (!cancelled) {
					setError(getErrorMessage(err, t('settings.storageProviders.loadError')));
					setProvider(null);
				}
			}
		);
		void window.app.getVault().then(
			(vault) => {
				if (!cancelled) setVaultEnabled(vault.enabled);
			},
			() => {
				if (!cancelled) setError(t('settings.privacy.encryption.loadFailed'));
			}
		);
		return () => {
			cancelled = true;
		};
	}, [t]);

	return (
		<SettingsSection title={t('settings.integrations.plugin.configuration')}>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{vaultEnabled && provider !== undefined && !provider?.hasPassphrase && <Portability />}
			{provider === undefined ? (
				<SettingsLoadingRows />
			) : (
				<StorageForm
					key={provider?.id ?? 'new'}
					enabledPresetIds={[]}
					provider={provider ?? undefined}
					onSaved={(saved) => {
						setProvider(saved);
						setError('');
						void window.storage
							.getSettings()
							.then((settings) =>
								settings.providerId === saved.id
									? settings
									: window.storage.saveSettings({ ...settings, providerId: saved.id })
							)
							.catch((err: unknown) => {
								setError(getErrorMessage(err, t('settings.storageProviders.saveError')));
							});
					}}
				/>
			)}
		</SettingsSection>
	);
}
