import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RadioTower } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
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
				icon={RadioTower}
				description={t('settings.channels.description')}
			/>
			<SettingsSection title={t('settings.channels.configuration')}>
				<div className="grid gap-2">
					<ChannelModelConfiguration kind="llm" />
					<ChannelModelConfiguration kind="stt" />
					<ChannelModelConfiguration kind="tts" />
				</div>
			</SettingsSection>
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
