import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Wrench } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
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
import { ChannelModelConfiguration } from './Model';
import { ChannelConnect } from './Connect';
import { ChannelRow } from './Row';
import { ProfileMediaModels } from '../assistant/profilemodels';

export default function ChannelsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [services, setServices] = useState<readonly CatalogService[]>([]);
	const [configuredIds, setConfiguredIds] = useState<ReadonlySet<string>>(new Set());
	const [selectedService, setSelectedService] = useState<CatalogService | null>(null);
	const [savingId, setSavingId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [connectionError, setConnectionError] = useState('');
	useEffect(() => {
		let mounted = true;
		void Promise.all([window.app.channels(), window.provider.listChannels()])
			.then(
				([entries, credentials]) => {
					if (!mounted) return;
					setServices(entries);
					setConfiguredIds(
						new Set(credentials.filter(({ configured }) => configured).map(({ id }) => id))
					);
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

	const openConnection = (service: CatalogService): void => {
		setConnectionError('');
		setSelectedService(service);
	};

	const saveConnection = async (apiKey: string): Promise<boolean> => {
		if (!selectedService) return false;
		const providerId = selectedService.provider.id;
		setSavingId(providerId);
		setConnectionError('');
		try {
			await window.provider.setChannel({ id: providerId, apiKey });
			setConfiguredIds((current) => new Set(current).add(providerId));
			return true;
		} catch (cause) {
			setConnectionError(cause instanceof Error ? cause.message : String(cause));
			return false;
		} finally {
			setSavingId(null);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.channels')}
				description={t('settings.channels.description')}
			/>
			<ChannelConnect
				key={selectedService?.provider.id ?? 'closed'}
				service={selectedService}
				configured={Boolean(selectedService && configuredIds.has(selectedService.provider.id))}
				saving={savingId === selectedService?.provider.id}
				error={connectionError}
				onClose={() => setSelectedService(null)}
				onSave={saveConnection}
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
			<SettingsSection title={t('settings.channels.integration')}>
				{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
				{loading ? (
					<SettingsLoadingRows rows={1} />
				) : services.length === 0 ? (
					<SettingsEmptyState title={t('settings.channels.notConfigured')} />
				) : (
					<div className="-mx-4 grid grid-cols-1 gap-x-2 gap-y-3 pb-4 md:grid-cols-2">
						{services.map((service) => (
							<ChannelRow
								key={`${service.provider.id}-${service.id}`}
								service={service}
								configured={configuredIds.has(service.provider.id)}
								saving={savingId === service.provider.id}
								onOpen={() => navigate(`/settings/channels/channelDetail/${service.provider.id}`)}
								onEdit={() => openConnection(service)}
							/>
						))}
					</div>
				)}
			</SettingsSection>
		</SettingsPageShell>
	);
}
