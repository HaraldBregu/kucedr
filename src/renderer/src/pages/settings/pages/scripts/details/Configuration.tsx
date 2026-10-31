import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StorageProvider } from '@shared/storage_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import { SettingsLoadingRows, SettingsNotice, SettingsSection } from '../../../components';
import StorageForm from './StorageForm';

interface ConfigurationProps {
	readonly name: string;
}

export default function Configuration({ name }: ConfigurationProps): React.JSX.Element {
	const { t } = useTranslation();
	const [provider, setProvider] = useState<StorageProvider | null>();
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		void window.storage.listProviders().then(
			(saved) => {
				if (!cancelled) setProvider(saved[0] ?? null);
			},
			(err: unknown) => {
				if (!cancelled) {
					setError(getErrorMessage(err, t('settings.storageProviders.loadError')));
					setProvider(null);
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [t]);

	return (
		<SettingsSection
			title={t('settings.integrations.plugin.configuration', { name })}
			description={t('settings.storageProviders.description')}
		>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
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
