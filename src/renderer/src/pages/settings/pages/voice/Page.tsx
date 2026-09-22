import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import RealtimeConversationConfiguration from '../assistant/conversation';

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
		</SettingsPageShell>
	);
}
