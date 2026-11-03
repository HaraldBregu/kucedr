import React from 'react';
import { Image, Mic, Music2, Video, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel } from '../../components';
import { AgentMediaModelConfiguration } from '../assistant/media';

export default function ModelsPage(): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.models')}
				description={t('settings.overview.descriptions.models')}
			/>
			<SettingsPanel>
				<AgentMediaModelConfiguration
					api={window.models.image}
					capability="text-to-image"
					idPrefix="models-image"
					title={t('settings.tabs.image')}
					description={t('settings.modelServices.imageModelDescription')}
					icon={Image}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>
				<AgentMediaModelConfiguration
					api={window.models.video}
					capability="text-to-video"
					idPrefix="models-video"
					title={t('settings.tabs.video')}
					description={t('settings.modelServices.videoModelDescription')}
					icon={Video}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>
				<AgentMediaModelConfiguration
					api={window.models.sound}
					capability="text-to-audio"
					idPrefix="models-sound"
					title={t('settings.tabs.music')}
					description={t('settings.modelServices.musicModelDescription')}
					icon={Music2}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>
				<AgentMediaModelConfiguration
					api={window.models.voice}
					capability="text-to-speech"
					idPrefix="models-voice"
					title={t('settings.modelServices.voiceName')}
					description={t('settings.modelServices.textToSpeechModelDescription')}
					icon={Volume2}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>
				<AgentMediaModelConfiguration
					api={window.models.transcribe}
					capability="speech-to-text"
					idPrefix="models-transcription"
					title={t('settings.modelServices.transcriptionName')}
					description={t('settings.modelServices.transcriptionDescription')}
					icon={Mic}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					showOptions={false}
				/>
			</SettingsPanel>
		</SettingsPageShell>
	);
}
