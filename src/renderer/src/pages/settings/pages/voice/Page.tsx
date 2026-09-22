import { ChevronRight, History, Radio, ShieldCheck, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
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

			<SettingsPanel>
				<Link to="/settings/voice/tools" className="block hover:bg-muted/40">
					<SettingsRow
						title={t('settings.modelServices.tools')}
						description={t('settings.modelServices.toolsDescription')}
						media={<Wrench className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</Link>
				<Link to="/settings/agent/permissions" className="block hover:bg-muted/40">
					<SettingsRow
						title={t('settings.tabs.permissions')}
						description={t('settings.overview.descriptions.permissions')}
						media={
							<ShieldCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</Link>
				<Link to="/settings/voice/history" className="block hover:bg-muted/40">
					<SettingsRow
						title={t('settings.modelServices.voiceHistoryTitle')}
						description={t('settings.modelServices.voiceHistoryDescription')}
						media={<History className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</Link>
			</SettingsPanel>
		</SettingsPageShell>
	);
}
