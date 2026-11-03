import { useTranslation } from 'react-i18next';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { ProfileMediaModels } from '../assistant/profilemodels';
import { ChannelModelConfiguration } from './Model';

export default function ChannelsConfigurationPage(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.channels.configuration')}
				description={t('settings.channels.configurationDescription')}
			/>
			<SettingsPanel>
				<ChannelModelConfiguration kind="llm" />
				<ChannelModelConfiguration kind="stt" />
				<ChannelModelConfiguration kind="tts" />
			</SettingsPanel>
			<SettingsSection title={t('settings.overview.groups.mlModels')}>
				<SettingsPanel>
					<ProfileMediaModels profileId="channels" />
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
}
