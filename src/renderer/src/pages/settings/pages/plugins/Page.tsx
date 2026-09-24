import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { McpData, McpSettings } from '@shared/mcp_types';
import type { CatalogService, EnabledPluginProviders, PluginProviderKind } from '@shared/provider_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { databases, mcps, storages } from '@/lib/providers';
import {
	SettingsEmptyState,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
} from '../../components';
import { MicrosoftConnect } from './Connect';
import CapabilityRow from './CapabilityRow';

const PluginsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [servers, setServers] = useState<McpSettings>({});
	const [enabledProviders, setEnabledProviders] = useState<EnabledPluginProviders>({ database: [], storage: [] });
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [selectedMicrosoft, setSelectedMicrosoft] = useState<CatalogService | null>(null);
	const catalog = mcps();
	const databaseCatalog = databases();
	const storageCatalog = storages();

	useEffect(() => {
		let cancelled = false;
		void Promise.all([window.mcp.list(), window.provider.listEnabledPlugins()]).then(
			([entries, enabled]) => {
				if (!cancelled) {
					setServers(entries);
					setEnabledProviders(enabled);
				}
			},
			(caught) => {
				if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
			}
		);
		return () => {
			cancelled = true;
		};
	}, []);

	const setProviderEnabled = async (kind: PluginProviderKind, id: string, enabled: boolean): Promise<void> => {
		setSavingId(id);
		setError('');
		try {
			setEnabledProviders(await window.provider.setPluginEnabled(kind, id, enabled));
			if (enabled) navigate(`/settings/providers/${kind}`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSavingId(null);
		}
	};

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

			{catalog.length + databaseCatalog.length + storageCatalog.length > 0 ? (
				<div className="-mx-4 grid grid-cols-1 gap-x-2 gap-y-3 pb-4 md:grid-cols-2">
					{catalog.map((service) => (
						<Item
							key={`${service.provider.id}-${service.id}`}
							role="link"
							tabIndex={0}
							onClick={() => navigate(`/settings/plugins/mcp/${service.provider.id}/${service.id}`)}
							onKeyDown={(event) => {
								if (
									event.target === event.currentTarget &&
									(event.key === 'Enter' || event.key === ' ')
								) {
									event.preventDefault();
									navigate(`/settings/plugins/mcp/${service.provider.id}/${service.id}`);
								}
							}}
							variant="ghost"
							size="md"
							className="min-w-0 cursor-pointer flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
						>
							<ProviderAvatar
								providerId={service.id}
								name={service.name}
								iconDarkUrl={service.iconDarkUrl}
								iconLightUrl={service.iconLightUrl}
								className="size-10 rounded-2xl border-0 bg-muted/50 p-1 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
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
												onClick={(event) => event.stopPropagation()}
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
										onClick={(event) => {
											event.stopPropagation();
											if (!servers[service.id] && service.url?.includes('{tenantId}')) {
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
					{databaseCatalog.map((database) => (
						<CapabilityRow
							key={`${database.provider.id}-${database.id}`}
							kind="database"
							entry={database}
							enabled={enabledProviders.database.includes(`${database.provider.id}/${database.id}`)}
							saving={savingId === `${database.provider.id}/${database.id}`}
							onOpen={() =>
								navigate(`/settings/plugins/database/${database.provider.id}/${database.id}`)
							}
							onAdd={() => void setProviderEnabled('database', `${database.provider.id}/${database.id}`, true)}
							onRemove={() => void setProviderEnabled('database', `${database.provider.id}/${database.id}`, false)}
						/>
					))}
					{storageCatalog.map((storage) => (
						<CapabilityRow
							key={`${storage.provider.id}-${storage.id}`}
							kind="storage"
							entry={storage}
							enabled={enabledProviders.storage.includes(`${storage.provider.id}/${storage.id}`)}
							saving={savingId === `${storage.provider.id}/${storage.id}`}
							onOpen={() =>
								navigate(`/settings/plugins/storage/${storage.provider.id}/${storage.id}`)
							}
							onAdd={() => void setProviderEnabled('storage', `${storage.provider.id}/${storage.id}`, true)}
							onRemove={() => void setProviderEnabled('storage', `${storage.provider.id}/${storage.id}`, false)}
						/>
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
