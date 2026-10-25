import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsNotice, SettingsPageHeader, SettingsPageShell } from '../../components';
import Available from './Available';
import Installed from './Installed';

const PluginsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const [successMessage, setSuccessMessage] = useState('');
	const [version, setVersion] = useState(0);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.integrations.title')}
				description={t('settings.integrations.description')}
			/>
			{successMessage && <SettingsNotice autoDismiss>{successMessage}</SettingsNotice>}
			<Installed key={version} />
			<Available
				key={`available-${version}`}
				onInstalled={(name) => {
					setSuccessMessage(t('settings.integrations.uploaded', { name }));
					setVersion((current) => current + 1);
				}}
			/>
		</SettingsPageShell>
	);
};

export default PluginsPage;
