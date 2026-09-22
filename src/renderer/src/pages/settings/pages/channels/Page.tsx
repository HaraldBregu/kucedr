import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, Wrench } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { ChannelModelConfiguration } from './Model';
import { TelegramConnection } from './Connection';

export default function ChannelsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [service, setService] = useState<CatalogService | null>(null);
	const [configured, setConfigured] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let mounted = true;
		void Promise.all([window.app.channels(), window.provider.getChannel('telegram')])
			.then(
				([services, credential]) => {
					if (!mounted) return;
					setService(services.find((entry) => entry.provider.id === 'telegram') ?? null);
					setConfigured(credential?.configured ?? false);
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
			<SettingsPanel>
				<ChannelModelConfiguration kind="llm" />
				<ChannelModelConfiguration kind="stt" />
				<ChannelModelConfiguration kind="tts" />
			</SettingsPanel>
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
			<SettingsSection title={t('settings.channels.integration')}>
				{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
				{loading ? (
					<SettingsLoadingRows rows={1} />
				) : (
					service && (
						<TelegramConnection
							service={service}
							configured={configured}
							onSaved={() => setConfigured(true)}
						/>
					)
				)}
			</SettingsSection>
		</SettingsPageShell>
	);
}
