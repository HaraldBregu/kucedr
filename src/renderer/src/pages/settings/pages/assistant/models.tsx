import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell } from '../../components';
import { AgentMediaModelConfiguration } from './media';
import { toolModelApi } from './toolmodel';

const audioApi = toolModelApi('audio');
const imageApi = toolModelApi('image');
const videoApi = toolModelApi('video');

export default function ModelsPage(): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.overview.groups.mlModels')}
				description={t('settings.modelServices.mediaModelsDescription')}
			/>
			<div>
				<AgentMediaModelConfiguration
					api={audioApi}
					capability="text-to-audio"
					idPrefix="agent-music"
					title={t('settings.tabs.music')}
					description={t('settings.modelServices.musicModelDescription')}
					showIcon={false}
					collapsible={false}
					padded={false}
					inlineAdvanced
				/>
				<AgentMediaModelConfiguration
					api={imageApi}
					capability="text-to-image"
					idPrefix="agent-image"
					title={t('settings.tabs.image')}
					description={t('settings.modelServices.imageModelDescription')}
					showIcon={false}
					collapsible={false}
					padded={false}
					inlineAdvanced
				/>
				<AgentMediaModelConfiguration
					api={videoApi}
					capability="text-to-video"
					idPrefix="agent-video"
					title={t('settings.tabs.video')}
					description={t('settings.modelServices.videoModelDescription')}
					showIcon={false}
					collapsible={false}
					padded={false}
					inlineAdvanced
				/>
			</div>
		</SettingsPageShell>
	);
}
