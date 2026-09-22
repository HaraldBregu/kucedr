import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel } from '../../components';
import { ProfileMediaModels } from './profilemodels';

export default function ModelsPage(): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.overview.groups.mlModels')}
				description={t('settings.modelServices.mediaModelsDescription')}
			/>
			<SettingsPanel>
				<ProfileMediaModels profileId="chat" />
			</SettingsPanel>
		</SettingsPageShell>
	);
}
