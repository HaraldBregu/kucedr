import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell } from '../../components';
import StoragePage from '../storage/Page';

const CloudPage: React.FC = () => {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.cloud')}
				description={t('settings.overview.descriptions.cloud')}
			/>
			<StoragePage inline />
		</SettingsPageShell>
	);
};

export default CloudPage;
