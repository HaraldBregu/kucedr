import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { McpData, McpSettings } from '@shared/mcp_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Switch } from '@/components/ui/switch';
import { mcps } from '@/lib/providers';
import {
	SettingsEmptyState,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';

const INTEGRATION_PROVIDER_IDS = [
	'gmail',
	'google-calendar',
	'google-drive',
	'github',
	'notion',
] as const;

const IntegrationsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const [servers, setServers] = useState<McpSettings>({});
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const catalog = INTEGRATION_PROVIDER_IDS.flatMap((providerId) =>
		mcps().filter((service) => service.provider.id === providerId)
	);

	useEffect(() => {
		let cancelled = false;
		void window.mcp.list().then(
			(entries) => {
				if (!cancelled) setServers(entries);
			},
			(caught) => {
				if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
			}
		);
		return () => {
			cancelled = true;
		};
	}, []);

	const setIntegrationEnabled = async (
		service: (typeof catalog)[number],
		enabled: boolean
	): Promise<void> => {
		setSavingId(service.id);
		setError('');
		const existing = servers[service.id];
		try {
			if (!enabled) {
				await window.mcp.delete(service.id);
				setServers((current) => {
					const next = { ...current };
					delete next[service.id];
					return next;
				});
				return;
			}

			const entry: McpData = existing
				? { ...existing, enabled: true }
				: {
						type: 'http',
						name: service.name,
						url: service.url ?? '',
						enabled: true,
					};
			await window.mcp.upsert(service.id, entry);
			setServers((current) => ({ ...current, [service.id]: entry }));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSavingId(null);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.integrations.title')}
				description={t('settings.integrations.description')}
			/>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}

			<SettingsSection
				title={t('settings.integrations.available')}
				description={t('settings.integrations.availableDescription')}
			>
				{catalog.length > 0 ? (
					<SettingsPanel>
						{catalog.map((service) => (
							<SettingsRow
								key={`${service.provider.id}-${service.id}`}
								title={service.name}
								description={service.provider.name}
								media={
									<ProviderAvatar
										providerId={service.provider.id}
										name={service.provider.name}
										iconDarkUrl={service.provider.iconDarkUrl}
										iconLightUrl={service.provider.iconLightUrl}
										className="size-10"
									/>
								}
								actionClassName="w-auto justify-end"
								actions={
									<Switch
										checked={servers[service.id]?.enabled === true}
										disabled={savingId === service.id}
										onCheckedChange={(enabled) =>
											void setIntegrationEnabled(service, enabled)
										}
										aria-label={service.name}
									/>
								}
							/>
						))}
					</SettingsPanel>
				) : (
					<SettingsEmptyState
						title={t('settings.integrations.empty')}
						description={t('settings.integrations.emptyDescription')}
					/>
				)}
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default IntegrationsPage;
