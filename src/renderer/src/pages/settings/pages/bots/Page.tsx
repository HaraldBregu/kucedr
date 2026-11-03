import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell } from '../../components';

const BotsPage: React.FC = () => {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.bots')}
				description={t('settings.overview.descriptions.bots')}
			/>
		</SettingsPageShell>
	);
};

export default BotsPage;
