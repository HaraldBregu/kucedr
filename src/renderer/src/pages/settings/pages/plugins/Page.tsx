import React, { useEffect, useState } from 'react';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { McpData, McpSettings } from '@shared/mcp_types';
import type { CatalogService } from '@shared/provider_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { mcps } from '@/lib/providers';
import {
	SettingsEmptyState,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
} from '../../components';
import { MicrosoftConnect } from './Connect';
import { MICROSOFT_365_SERVICES } from './Microsoft';

const PLUGIN_SERVICE_IDS = [
	'gmail',
	'google-calendar',
	'google-drive',
	'google-contacts',
	'google-docs',
	'google-sheets',
	'google-maps',
	'github',
	'gitlab',
	'microsoft-learn',
	'notion',
] as const;

const PluginsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const [servers, setServers] = useState<McpSettings>({});
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [selectedMicrosoft, setSelectedMicrosoft] = useState<CatalogService | null>(null);
	const services = mcps();
	const microsoft = services.find((service) => service.id === 'microsoft-learn');
	const microsoftServices: CatalogService[] = microsoft
		? MICROSOFT_365_SERVICES.map(({ id, name, description }) => ({
				id,
				name,
				description,
				type: 'mcp',
				provider: microsoft.provider,
				iconDarkUrl: microsoft.iconDarkUrl,
				iconLightUrl: microsoft.iconLightUrl,
			}))
		: [];
	const catalog = PLUGIN_SERVICE_IDS.flatMap((serviceId) => [
		...services.filter((service) => service.id === serviceId),
		...(serviceId === 'microsoft-learn' ? microsoftServices : []),
	]);

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
		enabled: boolean,
		configuration?: { readonly url: string; readonly clientId: string }
	): Promise<boolean> => {
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
				return true;
			}

			const entry: McpData = existing
				? { ...existing, enabled: true }
				: {
						type: 'http',
						name: service.name,
						url: configuration?.url ?? service.url ?? '',
						...(configuration ? { client_id: configuration.clientId } : {}),
						enabled: true,
					};
			await window.mcp.upsert(service.id, entry);
			setServers((current) => ({ ...current, [service.id]: entry }));
			return true;
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			return false;
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
			<MicrosoftConnect
				service={selectedMicrosoft}
				onClose={() => setSelectedMicrosoft(null)}
				onConnect={(url, clientId) =>
					selectedMicrosoft
						? setIntegrationEnabled(selectedMicrosoft, true, { url, clientId })
							: Promise.resolve(false)
				}
				saving={savingId === selectedMicrosoft?.id}
				error={error}
			/>

			{catalog.length > 0 ? (
				<div className="-mx-4 grid grid-cols-1 gap-x-2 gap-y-1 pb-4 md:grid-cols-2">
					{catalog.map((service) => (
						<Item
							key={`${service.provider.id}-${service.id}`}
							variant="ghost"
							size="md"
							className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
						>
							<ProviderAvatar
								providerId={service.id}
								name={service.name}
								iconDarkUrl={service.iconDarkUrl}
								iconLightUrl={service.iconLightUrl}
								className="size-9 rounded-2xl border-0 bg-muted/50 p-1.5 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
							/>
							<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
								<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
									{service.name}
								</ItemTitle>
								<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
									{service.description}
								</p>
							</ItemContent>
							<ItemActions className="ml-auto flex-none justify-end">
								{servers[service.id]?.enabled === true ? (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												className="hover:bg-transparent dark:hover:bg-transparent"
												disabled={savingId === service.id}
												aria-label={t('settings.integrations.options', { name: service.name })}
											>
												<MoreHorizontal className="size-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => void setIntegrationEnabled(service, false)}>
												<Trash2 />
												{t('settings.integrations.remove', { name: service.name })}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								) : (
									<Button
										variant="ghost"
										size="icon-sm"
										className="hover:bg-transparent dark:hover:bg-transparent"
										disabled={savingId === service.id}
									onClick={() => {
										if (MICROSOFT_365_SERVICES.some((entry) => entry.id === service.id)) {
											setError('');
											setSelectedMicrosoft(service);
										} else {
											void setIntegrationEnabled(service, true);
										}
									}}
										aria-label={t('settings.integrations.add', { name: service.name })}
									>
										<Plus className="size-4" />
									</Button>
								)}
							</ItemActions>
						</Item>
					))}
				</div>
			) : (
				<SettingsEmptyState
					title={t('settings.integrations.empty')}
					description={t('settings.integrations.emptyDescription')}
				/>
			)}
		</SettingsPageShell>
	);
};

export default PluginsPage;
