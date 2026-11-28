import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../components';

const MEDIA = ['text', 'image', 'sound', 'video', 'transcribe', 'voice', 'realtimeVoice'] as const;

interface Destination {
	title: string;
	name: string;
	description: string;
}

export function Destinations(): React.JSX.Element {
	const { t } = useTranslation();
	const [destinations, setDestinations] = useState<Destination[]>([]);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let active = true;
		void Promise.all([
			window.agent.getProvider(),
			window.search.getSettings(),
			window.search.listProviders(),
			window.models.embedding.getProviderId(),
			window.provider.getModelProviders(),
			window.database.getConfiguration(),
			window.database.list(),
			window.storage.getSettings(),
			window.storage.listProviders(),
			Promise.all(MEDIA.map((slot) => window.models[slot].getProviderId())),
			window.mcp.list(),
		]).then(
			([chat, search, searchProviders, embeddingId, modelProviders, database, databases, sync, storage, media, mcp]) => {
				if (!active) return;
				const next: Destination[] = [];
				if (chat) {
					next.push({
						title: t('settings.privacy.destinations.chat'),
						name: chat.name,
						description: t('settings.privacy.destinations.chatDescription'),
					});
				}
				if (search.engineId) {
					next.push({
						title: t('settings.privacy.destinations.search'),
						name: searchProviders.find((provider) => provider.id === search.engineId)?.name ?? search.engineId,
						description: t('settings.privacy.destinations.searchDescription'),
					});
				}
				if (embeddingId) {
					next.push({
						title: t('settings.privacy.destinations.embedding'),
						name: modelProviders.find((provider) => provider.id === embeddingId)?.name ?? embeddingId,
						description: t('settings.privacy.destinations.embeddingDescription'),
					});
				}
				const mediaNames = [...new Set(media.filter((id): id is string => Boolean(id)))].map(
					(id) => modelProviders.find((provider) => provider.id === id)?.name ?? id
				);
				if (mediaNames.length) {
					next.push({
						title: t('settings.privacy.destinations.media'),
						name: mediaNames.join(', '),
						description: t('settings.privacy.destinations.mediaDescription'),
					});
				}
				const hosts = [
					...new Set(
						Object.values(mcp).flatMap((server) => {
							if (server.type !== 'http') return [];
							try {
								return [new URL(server.url).host];
							} catch {
								return [];
							}
						})
					),
				];
				if (hosts.length) {
					next.push({
						title: t('settings.privacy.destinations.tools'),
						name: hosts.join(', '),
						description: t('settings.privacy.destinations.toolsDescription'),
					});
				}
				if (database.providerId && database.databaseId) {
					const service = databases.find(
						(item) => item.providerId === database.providerId && item.databaseId === database.databaseId
					);
					if (service) {
						next.push({
							title: t('settings.privacy.destinations.knowledge'),
							name: `${service.providerName} · ${service.databaseName}`,
							description: t('settings.privacy.destinations.knowledgeDescription'),
						});
					}
				}
				if (sync.syncEnabled && sync.providerId) {
					const provider = storage.find((item) => item.id === sync.providerId);
					if (provider) {
						next.push({
							title: t('settings.privacy.destinations.backup'),
							name: provider.name,
							description: t('settings.privacy.destinations.backupDescription'),
						});
					}
				}
				setDestinations(next);
				setFailed(false);
			},
			() => {
				if (active) setFailed(true);
			}
		);
		return () => {
			active = false;
		};
	}, [t]);

	return (
		<SettingsSection
			title={t('settings.privacy.destinations.title')}
			description={t('settings.privacy.destinations.description')}
		>
			{failed ? (
				<SettingsNotice variant="destructive">
					{t('settings.privacy.destinations.loadError')}
				</SettingsNotice>
			) : (
				<SettingsPanel>
					{destinations.map((destination) => (
						<SettingsRow
							key={destination.title}
							title={destination.title}
							description={destination.description}
							actions={<span className="text-sm text-foreground">{destination.name}</span>}
						/>
					))}
					<SettingsRow
						title={t('settings.privacy.destinations.extensions')}
						description={t('settings.privacy.destinations.extensionsDescription')}
						actions={
							<Link to="/settings/plugins" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
								{t('settings.privacy.destinations.reviewExtensions')}
							</Link>
						}
					/>
				</SettingsPanel>
			)}
		</SettingsSection>
	);
}
