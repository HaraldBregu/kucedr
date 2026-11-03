import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Settings2, Wrench } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
import type { ChannelCredentialSummary } from '@shared/channels_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../../components';
import { ChannelConfiguration } from '../Channel';

export default function ChannelDetailsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const { pluginId, channelId } = useParams();
	const id = `${pluginId}/${channelId}`;
	const [service, setService] = useState<CatalogService | null>();
	const [stored, setStored] = useState<ChannelCredentialSummary>();
	const [error, setError] = useState<string>();
	useEffect(() => {
		let mounted = true;
		void Promise.all([window.app.channels(), window.provider.listChannels()]).then(
			([services, credentials]) => {
				if (mounted) {
					setService(services.find((entry) => entry.provider.id === id) ?? null);
					setStored(credentials.find((entry) => entry.id === id));
				}
			},
			(cause) => {
				if (mounted) {
					setError(cause instanceof Error ? cause.message : t('settings.channels.errors.load'));
					setService(null);
				}
			}
		);
		return () => {
			mounted = false;
		};
	}, [id, t]);
	return (
		<SettingsPageShell>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			{service === undefined ? (
				<SettingsPanel>
					<SettingsLoadingRows rows={1} />
				</SettingsPanel>
			) : !service ? (
				<SettingsEmptyState title={id} />
			) : (
				<>
					<SettingsPageHeader title={service.name} description={service.description} />
					<ChannelConfiguration service={service} stored={stored} />
					<SettingsPanel>
						<Link to="/settings/channels/configuration" className="block hover:bg-muted/40">
							<SettingsRow
								title={t('settings.channels.configuration')}
								description={t('settings.channels.configurationDescription')}
								icon={Settings2}
								actions={<ChevronRight className="size-4 text-muted-foreground" />}
							/>
						</Link>
						<Link to="/settings/channels/tools" className="block hover:bg-muted/40">
							<SettingsRow
								title={t('settings.modelServices.tools')}
								description={t('settings.modelServices.toolsDescription')}
								icon={Wrench}
								actions={<ChevronRight className="size-4 text-muted-foreground" />}
							/>
						</Link>
					</SettingsPanel>
				</>
			)}
		</SettingsPageShell>
	);
}
