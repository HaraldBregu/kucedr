import React from 'react';
import { Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mcps } from '@/lib/providers';
import {
	SettingsEmptyState,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsSection,
} from '../../components';
import { McpCard } from '../providers/McpCard';

const INTEGRATION_PROVIDER_IDS = [
	'gmail',
	'google-calendar',
	'google-drive',
	'github',
	'notion',
] as const;

const IntegrationsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const catalog = INTEGRATION_PROVIDER_IDS.flatMap((providerId) =>
		mcps().filter((service) => service.provider.id === providerId)
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.integrations.title')}
				description={t('settings.integrations.description')}
				icon={Plug}
			/>

			<SettingsSection
				title={t('settings.integrations.available')}
				description={t('settings.integrations.availableDescription')}
			>
				{catalog.length > 0 ? (
					<div className="space-y-3">
						{catalog.map((service) => (
							<McpCard key={`${service.provider.id}-${service.id}`} service={service} />
						))}
					</div>
				) : (
					<SettingsEmptyState
						icon={Plug}
						title={t('settings.integrations.empty')}
						description={t('settings.integrations.emptyDescription')}
					/>
				)}
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default IntegrationsPage;
