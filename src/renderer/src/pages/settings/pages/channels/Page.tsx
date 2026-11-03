import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
import type { ChannelCredentialSummary } from '@shared/channels_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import {
	SettingsLoadingRows,
	SettingsEmptyState,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../components';

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
					if (mounted) {
						setServices(entries);
						setCredentials(stored);
					}
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
				<SettingsPanel>
					<SettingsLoadingRows rows={1} />
				</SettingsPanel>
			) : services.length === 0 ? (
				<SettingsEmptyState title={t('settings.channels.notConfigured')} />
			) : (
				<SettingsPanel>
					{services.map((service) => {
						const [plugin, channel] = service.provider.id.split('/');
						const configured = credentials.find(({ id }) => id === service.provider.id)?.configured;
						return (
							<Link
								key={service.provider.id}
								to={`/settings/channels/${encodeURIComponent(plugin)}/${encodeURIComponent(channel)}`}
								className="block hover:bg-muted/40"
							>
								<SettingsRow
									title={service.name}
									description={t(
										`settings.channels.${configured ? 'configured' : 'notConfigured'}`
									)}
									media={
										<ProviderAvatar
											providerId={service.provider.id}
											name={service.provider.name}
											iconDarkUrl={service.provider.iconDarkUrl}
											iconLightUrl={service.provider.iconLightUrl}
											className="size-5 rounded-md"
										/>
									}
									actions={<ChevronRight className="size-4 text-muted-foreground" />}
								/>
							</Link>
						);
					})}
				</SettingsPanel>
			)}
		</SettingsPageShell>
	);
}
