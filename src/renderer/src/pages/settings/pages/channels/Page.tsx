import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, Wrench } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
import type { ChannelCredentialSummary } from '@shared/channels_types';
import {
	SettingsLoadingRows,
	SettingsEmptyState,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { ProfileMediaModels } from '../assistant/profilemodels';
import { ChannelConfiguration } from './Channel';
import { ChannelModelConfiguration } from './Model';

export default function ChannelsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [services, setServices] = useState<readonly CatalogService[]>([]);
	const [credentials, setCredentials] = useState<readonly ChannelCredentialSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let mounted = true;
		void Promise.all([window.app.channels(), window.provider.listChannels()])
			.then(
				([entries, stored]) => {
					if (!mounted) return;
					setServices(entries);
					setCredentials(stored);
					setError(null);
				},
				(cause) => {
					if (mounted)
						setError(cause instanceof Error ? cause.message : t('settings.channels.errors.load'));
				}
			)
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [t]);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.channels')}
				description={t('settings.channels.description')}
			/>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			{loading ? (
				<SettingsLoadingRows rows={1} />
			) : services.length === 0 ? (
				<SettingsEmptyState title={t('settings.channels.notConfigured')} />
			) : (
				services.map((service) => (
					<ChannelConfiguration
						key={`${service.provider.id}-${service.id}`}
						service={service}
						stored={credentials.find(({ id }) => id === service.provider.id)}
					/>
				))
			)}
			<SettingsSection
				title={t('settings.channels.configuration')}
				description={t('settings.channels.configurationDescription')}
			>
				<SettingsPanel>
					<ChannelModelConfiguration kind="llm" />
					<ChannelModelConfiguration kind="stt" />
					<ChannelModelConfiguration kind="tts" />
				</SettingsPanel>
			</SettingsSection>
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
