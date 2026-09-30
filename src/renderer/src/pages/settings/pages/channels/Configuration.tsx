import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, Wrench } from 'lucide-react';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { ProfileMediaModels } from '../assistant/profilemodels';
import { ChannelModelConfiguration } from './Model';

export default function ChannelConfigurationPage(): React.JSX.Element {
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
			<SettingsPanel>
				<Link to="/settings/channels/tools" className="block hover:bg-muted/40">
					<SettingsRow
						title={t('settings.modelServices.tools')}
						description={t('settings.modelServices.toolsDescription')}
						media={<Wrench className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</Link>
			</SettingsPanel>
		</SettingsPageShell>
	);
}
