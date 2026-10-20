import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsNotice, SettingsPageHeader, SettingsPageShell } from '../../components';
import { SettingsUpload } from '../../components/upload';
import Installed from './Installed';

const PluginsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const [uploading, setUploading] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [version, setVersion] = useState(0);

	const handleUpload = async (paths?: string[]): Promise<void> => {
		setUploading(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			// ponytail: one plugin per drop; the rest of a multi-drop is ignored
			const installed = await window.plugins.upload(paths?.[0]);
			if (installed) {
				setSuccessMessage(t('settings.integrations.uploaded', { name: installed.name }));
				setVersion((current) => current + 1);
			}
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : t('settings.integrations.uploadError')
			);
		} finally {
			setUploading(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.integrations.title')}
				description={t('settings.integrations.description')}
			/>
			{errorMessage && (
				<SettingsNotice
					variant="destructive"
					icon={AlertTriangle}
					className="whitespace-pre-wrap break-words"
				>
					{errorMessage}
				</SettingsNotice>
			)}
			{successMessage && <SettingsNotice autoDismiss>{successMessage}</SettingsNotice>}
			<SettingsUpload
				title={t('settings.integrations.dropTitle')}
				description={t('settings.integrations.dropDescription')}
				busy={uploading}
				busyLabel={t('settings.integrations.uploading')}
				onUpload={(paths) => void handleUpload(paths)}
			/>
			<Installed key={version} />
		</SettingsPageShell>
	);
};

export default PluginsPage;
