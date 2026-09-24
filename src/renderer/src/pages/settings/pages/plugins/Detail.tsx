import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import { databases, mcps, storages } from '@/lib/providers';
import { SettingsEmptyState, SettingsPageShell, SettingsSection } from '../../components';

export default function PluginDetailPage(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { kind, providerId, entryId } = useParams<{
		kind: string;
		providerId: string;
		entryId: string;
	}>();
	const catalog = kind === 'mcp' ? mcps() : kind === 'database' ? databases() : kind === 'storage' ? storages() : [];
	const entry = catalog.find((item) => item.provider.id === providerId && item.id === entryId);
	const storage = kind === 'storage' ? storages().find((item) => item.provider.id === providerId && item.id === entryId) : undefined;
	const endpoint = storage?.metadata.endpointTemplate ?? (entry && 'url' in entry ? entry.url : undefined);

	return (
		<SettingsPageShell>
			<Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/settings/plugins')}>
				<ArrowLeft className="size-4" />
				{t('settings.integrations.title')}
			</Button>
			{entry ? (
				<>
					<header className="flex items-start gap-4 py-2">
						<ProviderAvatar
							providerId={kind === 'mcp' ? entry.id : entry.provider.id}
							name={entry.name}
							iconDarkUrl={'iconDarkUrl' in entry ? entry.iconDarkUrl : entry.provider.iconDarkUrl}
							iconLightUrl={'iconLightUrl' in entry ? entry.iconLightUrl : entry.provider.iconLightUrl}
							className="size-16 rounded-2xl border-0 bg-muted/50 p-2"
						/>
						<div className="min-w-0">
							<h1 className="text-2xl font-medium leading-tight">{entry.name}</h1>
							{entry.description && <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>}
						</div>
					</header>
					<SettingsSection title={t('settings.integrations.details')}>
						<dl className="divide-y divide-border/60 rounded-xl bg-muted/30 px-4">
							<div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
								<dt className="text-xs text-muted-foreground">{t('settings.integrations.provider')}</dt>
								<dd className="min-w-0 text-sm">{entry.provider.name}</dd>
							</div>
							<div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
								<dt className="text-xs text-muted-foreground">{t('settings.integrations.type')}</dt>
								<dd className="min-w-0 text-sm">
									{kind === 'mcp'
										? t('settings.integrations.mcpType')
										: kind === 'database' && 'type' in entry
											? t('settings.integrations.databaseType', { type: entry.type })
											: t('settings.integrations.storageType')}
								</dd>
							</div>
							<div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
								<dt className="text-xs text-muted-foreground">{t('settings.integrations.authentication')}</dt>
								<dd className="min-w-0 text-sm">{entry.authentication ? t(`settings.integrations.authTypes.${entry.authentication}`) : t('settings.integrations.authTypes.none')}</dd>
							</div>
							{endpoint && (
								<div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
									<dt className="text-xs text-muted-foreground">{t('settings.integrations.endpoint')}</dt>
									<dd className="min-w-0 break-all text-sm">{endpoint}</dd>
								</div>
							)}
							{storage?.metadata.region && (
								<div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
									<dt className="text-xs text-muted-foreground">{t('settings.integrations.region')}</dt>
									<dd className="min-w-0 text-sm">{storage.metadata.region}</dd>
								</div>
							)}
						</dl>
					</SettingsSection>
				</>
			) : (
				<SettingsEmptyState title={t('settings.integrations.notFound')} />
			)}
		</SettingsPageShell>
	);
}
