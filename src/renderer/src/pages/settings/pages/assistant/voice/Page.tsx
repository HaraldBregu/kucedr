import { Mic, Radio, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../../components';
import RealtimeConversationConfiguration from '../conversation';
import { AgentMediaModelConfiguration } from '../media';

export default function VoicePage(): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.voice')}
				description={t('settings.modelServices.voiceDescription')}
			/>

			<SettingsPanel>
				<AgentMediaModelConfiguration
					api={window.models.voice}
					capability="text-to-speech"
					idPrefix="agent-voice"
					title={t('settings.modelServices.voiceName')}
					description={t('settings.modelServices.textToSpeechModelDescription')}
					showIcon
					icon={Volume2}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>

				<AgentMediaModelConfiguration
					api={window.models.transcribe}
					capability="speech-to-text"
					idPrefix="agent-transcription"
					title={t('settings.modelServices.transcriptionName')}
					description={t('settings.modelServices.transcriptionDescription')}
					showIcon
					icon={Mic}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					showOptions={false}
				/>
			</SettingsPanel>

			<SettingsPanel>
				<RealtimeConversationConfiguration
					icon={Radio}
					showFieldLabel={false}
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
				/>
			</SettingsPanel>
		</SettingsPageShell>
	);
}
