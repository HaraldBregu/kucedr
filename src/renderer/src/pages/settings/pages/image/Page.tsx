import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'lucide-react';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel } from '../../components';
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
			<SettingsPanel>
				<AgentMediaModelConfiguration
					api={api}
					capability="text-to-image"
					idPrefix="agent-image"
					title={t('settings.tabs.image')}
					description={t('settings.modelServices.imageModelDescription')}
					icon={Image}
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
