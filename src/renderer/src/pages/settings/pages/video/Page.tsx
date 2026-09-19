import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell } from '../../components';
import { AgentMediaModelConfiguration } from '../assistant/media';
import { toolModelApi } from '../assistant/toolmodel';

const api = toolModelApi('video');

export default function VideoPage(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.video')}
				description={t('settings.modelServices.videoModelDescription')}
			/>
			<div className="-mx-2">
				<AgentMediaModelConfiguration
					api={api}
					capability="text-to-video"
					idPrefix="agent-video"
					title={t('settings.tabs.video')}
					description={t('settings.modelServices.videoModelDescription')}
					showIcon={false}
					collapsible={false}
					inlineAdvanced
				/>
			</div>
		</SettingsPageShell>
	);
}
