import React from 'react';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel } from '../../components';
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
			<SettingsPanel>
				<AgentMediaModelConfiguration
					api={api}
					capability="text-to-video"
					idPrefix="agent-video"
					title={t('settings.tabs.video')}
					description={t('settings.modelServices.videoModelDescription')}
					icon={Video}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>
			</SettingsPanel>
		</SettingsPageShell>
	);
}
