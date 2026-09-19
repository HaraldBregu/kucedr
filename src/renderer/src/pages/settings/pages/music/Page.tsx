import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell } from '../../components';
import { AgentMediaModelConfiguration } from '../assistant/media';
import { toolModelApi } from '../assistant/toolmodel';

const api = toolModelApi('audio');

export default function MusicPage(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsPageShell className="px-4 sm:px-6">
			<SettingsPageHeader
				title={t('settings.tabs.music')}
				description={t('settings.modelServices.musicModelDescription')}
			/>
			<div>
				<AgentMediaModelConfiguration
					api={api}
					capability="text-to-audio"
					idPrefix="agent-music"
					title={t('settings.tabs.music')}
					description={t('settings.modelServices.musicModelDescription')}
					showIcon={false}
					collapsible={false}
					inlineAdvanced
				/>
			</div>
		</SettingsPageShell>
	);
}
