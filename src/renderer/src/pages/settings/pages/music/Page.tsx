import React from 'react';
import { useTranslation } from 'react-i18next';
import { Music2 } from 'lucide-react';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel } from '../../components';
import { AgentMediaModelConfiguration } from '../assistant/media';
import { toolModelApi } from '../assistant/toolmodel';

const api = toolModelApi('audio');

export default function MusicPage(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.music')}
				description={t('settings.modelServices.musicModelDescription')}
			/>
			<SettingsPanel>
				<AgentMediaModelConfiguration
					api={api}
					capability="text-to-audio"
					idPrefix="agent-music"
					title={t('settings.tabs.music')}
					description={t('settings.modelServices.musicModelDescription')}
					icon={Music2}
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
