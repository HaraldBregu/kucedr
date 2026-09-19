import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell } from '../../components';
import { AgentMediaModelConfiguration } from '../assistant/media';
import { toolModelApi } from '../assistant/toolmodel';

const api = toolModelApi('image');

export default function ImagePage(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.image')}
				description={t('settings.modelServices.imageModelDescription')}
			/>
			<div className="-mx-2">
				<AgentMediaModelConfiguration
					api={api}
					capability="text-to-image"
					idPrefix="agent-image"
					title={t('settings.tabs.image')}
					description={t('settings.modelServices.imageModelDescription')}
					showIcon={false}
					collapsible={false}
					inlineAdvanced
				/>
			</div>
		</SettingsPageShell>
	);
}
