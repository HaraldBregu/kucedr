import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell } from '../../components';
import { AgentMediaModelConfiguration } from '../assistant/media';
import { toolModelApi } from '../assistant/toolmodel';

const api = toolModelApi('video');

export default function VideoPage(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsPageShell className="px-4 sm:px-6">
			<SettingsPageHeader
				title={t('settings.tabs.video')}
				description={t('settings.modelServices.videoModelDescription')}
			/>
			<div>
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
