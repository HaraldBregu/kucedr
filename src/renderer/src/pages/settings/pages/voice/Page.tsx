import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import RealtimeConversationConfiguration from '../assistant/conversation';
import ChatHistoryPage from '../assistant/chathistory/Page';

export default function VoicePage(): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.voice')}
				description={t('settings.modelServices.realtimeConversationDescription')}
			/>

			<SettingsPanel>
				<RealtimeConversationConfiguration
					icon={Radio}
					showFieldLabel={false}
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
				/>
			</SettingsPanel>

			<SettingsSection
				title={t('settings.modelServices.voiceHistoryTitle')}
				description={t('settings.modelServices.voiceHistoryDescription')}
			>
				<ChatHistoryPage category="voice" embedded />
			</SettingsSection>
		</SettingsPageShell>
	);
}
