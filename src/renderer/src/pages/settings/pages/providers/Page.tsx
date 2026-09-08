import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, LoaderCircle, Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { openExternalUrl } from '@/lib/external-links';
import { cn } from '@/lib/utils';
import type { StoredProviderKind } from '@shared/provider_types';
import type { SearchEngineId, SearchSettings } from '@shared/search_types';
import type { McpData } from '@shared/mcp_types';
import { mcps } from '@/lib/providers';
import {
	actionableProviderCatalog,
	actionableSearchCatalog,
	getErrorMessage,
	MASKED_API_KEY_LABEL,
} from '../../../start/setupConstants';
import type { ProviderCatalogItem, ProviderSetupEntry } from '../../../start/setupTypes';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsSection,
} from '../../components';
import { McpCard } from './McpCard';
import { CustomMcpCard } from '../mcp/components/CustomMcpCard';
import { McpServerForm } from '../mcp/components/McpServerForm';
import { useMcpServers } from '../mcp/hooks/useMcpServers';

type ProviderKind = Exclude<StoredProviderKind, 'databases' | 'channels'> | 'search';
export type ProviderSetupSection = 'models' | 'search' | 'mcp';

const SECTION_HEADERS: Record<ProviderSetupSection, { titleKey: string; descriptionKey: string }> =
	{
		models: {
			titleKey: 'settings.overview.groups.mlModels',
			descriptionKey: 'settings.overview.descriptions.providers',
		},
		search: {
			titleKey: 'settings.tabs.searchEngines',
			descriptionKey: 'settings.overview.descriptions.searchEngine',
		},
		mcp: {
			titleKey: 'settings.tabs.mcp',
			descriptionKey: 'settings.overview.descriptions.mcp',
		},
	};

/** Providers pinned on top of the start-flow models list. */
const FEATURED_PROVIDER_IDS = ['openai', 'anthropic', 'deepseek', 'elevenlabs'] as const;

function allCatalogItems(): ProviderCatalogItem[] {
	return [
		...actionableProviderCatalog(),
		...actionableSearchCatalog(),
	];
}

interface ProvidersPageProps {
	readonly embedded?: boolean;
	readonly section?: ProviderSetupSection;
}

const ProvidersPage: React.FC<ProvidersPageProps> = ({ embedded = false, section }) => {
	const { t } = useTranslation();
	const [providerEntries, setProviderEntries] = useState<ProviderSetupEntry[]>(() =>
		allCatalogItems().map((provider, index) => ({
			providerId: provider.id,
			apiKey: '',
			apiKeySaved: false,
			editing: index === 0,
		}))
	);
	const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [vaultWarning, setVaultWarning] = useState<string | null>(null);
	const [searchSettings, setSearchSettings] = useState<SearchSettings | null>(null);
	const [addingCustomMcp, setAddingCustomMcp] = useState(false);
	const { servers: mcpServers, load: loadMcpServers } = useMcpServers();

	useEffect(() => {
		let cancelled = false;

		void window.provider.list('models')
			.then((storedProviders) => {
				if (cancelled) return;
				const savedStatus: Record<string, boolean> = Object.fromEntries(
					storedProviders.map((provider) => [
						provider.id,
						provider.configured,
					])
				);
				const hasSavedProvider = allCatalogItems().some((provider) => savedStatus[provider.id]);

				setProviderEntries((currentEntries) =>
					allCatalogItems().map((provider, index) => {
						const current = currentEntries.find((entry) => entry.providerId === provider.id);
						const draft = current?.apiKey ?? '';
						const hasDraft = draft.trim().length > 0;
						const saved = savedStatus[provider.id] ?? false;

						return {
							providerId: provider.id,
							apiKey: draft,
							apiKeySaved: saved,
							editing: hasDraft
								? (current?.editing ?? false)
								: saved
									? false
									: (current?.editing ?? (!hasSavedProvider && index === 0)),
						};
					})
				);
			})
			.catch((err) => {
				if (cancelled) return;
				setError(getErrorMessage(err, 'Could not check saved provider access.'));
			});
		void window.provider.vaultStatus().then(
			(status) => {
				if (!cancelled) setVaultWarning(status.warning ?? null);
			},
			() => undefined
		);

		void window.search.getSettings().then(
			(settings) => {
				if (!cancelled) setSearchSettings(settings);
			},
			(err) => {
				if (!cancelled) setError(getErrorMessage(err, 'Could not load search providers.'));
			}
		);

		return () => {
			cancelled = true;
		};
	}, [t]);

	const updateProviderEntry = (providerId: string, patch: Partial<ProviderSetupEntry>): void => {
		setProviderEntries((currentEntries) => {
			if (!currentEntries.some((entry) => entry.providerId === providerId)) {
				return [
					...currentEntries,
					{ providerId, apiKey: '', apiKeySaved: false, editing: false, ...patch },
				];
			}
			return currentEntries.map((entry) =>
				entry.providerId === providerId ? { ...entry, ...patch } : entry
			);
		});
	};

	const handleProviderApiKeyChange = (providerId: string, apiKey: string): void => {
		updateProviderEntry(providerId, { apiKey });
		setError(null);
	};

	const handleOpenProviderLink = (provider: ProviderCatalogItem): void => {
		if (!provider.apiConfigurationUrl) return;
		openExternalUrl(provider.apiConfigurationUrl);
	};

	const saveProviderEntry = async (
		providerId: string,
		kind: Exclude<StoredProviderKind, 'databases' | 'channels'>
	): Promise<void> => {
		const entry = providerEntries.find((item) => item.providerId === providerId);
		const apiKey = entry?.apiKey.trim() ?? '';
		if (!entry || !apiKey) return;

		setSavingProviderId(providerId);
		setError(null);
		try {
			await window.provider.set({ id: providerId, apiKey, kind });
			updateProviderEntry(providerId, { apiKey: '', apiKeySaved: true, editing: false });
		} catch (err) {
			setError(getErrorMessage(err, 'Could not save provider API key.'));
		} finally {
			setSavingProviderId(null);
		}
	};

	const saveSearchEntry = async (providerId: string): Promise<void> => {
		const entry = providerEntries.find((item) => item.providerId === providerId);
		const apiKey = entry?.apiKey.trim() ?? '';
		if (!entry || !apiKey) return;

		setSavingProviderId(providerId);
		setError(null);
		try {
			setSearchSettings(await window.search.saveEngine(providerId as SearchEngineId, { apiKey }));
			updateProviderEntry(providerId, { apiKey: '', apiKeySaved: true, editing: false });
		} catch (err) {
			setError(getErrorMessage(err, 'Could not save search provider API key.'));
		} finally {
			setSavingProviderId(null);
		}
	};

	const renderProviderCard = (
		provider: ProviderCatalogItem,
		kind: ProviderKind
	): React.ReactElement => {
		const entry = providerEntries.find((item) => item.providerId === provider.id);
		const connected =
			kind === 'search'
				? (searchSettings?.configured[provider.id as SearchEngineId] ?? false)
				: (entry?.apiKeySaved ?? false);
		const editing = entry?.editing ?? false;
		const savingThisProvider = savingProviderId === provider.id;
		const canSaveProvider = !!entry && !savingThisProvider && entry.apiKey.trim().length > 0;

		return (
			<Card
				key={provider.id}
				className={cn(
					'rounded-lg border-border bg-card py-0 shadow-none',
					editing && 'border-ring ring-2 ring-ring/20',
					!provider.supported && 'opacity-70'
				)}
			>
				<CardContent className="p-0">
					<div
						className={cn(
							'grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5',
							editing && 'pb-2'
						)}
					>
						<ProviderAvatar
							providerId={provider.id}
							name={provider.name}
							iconDarkUrl={provider.iconDarkUrl}
							iconLightUrl={provider.iconLightUrl}
						/>
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 items-center gap-1.5">
								<h2 className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
									{provider.name}
								</h2>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									className="size-5 text-muted-foreground hover:text-foreground"
									aria-label={`Open ${provider.name} API setup`}
									onClick={() => handleOpenProviderLink(provider)}
								>
									<ExternalLink className="size-3" />
								</Button>
							</div>
							<p className="truncate text-xs font-medium leading-tight text-muted-foreground">
								{connected ? MASKED_API_KEY_LABEL : provider.capabilities}
							</p>
						</div>
						<div className="flex shrink-0 justify-end gap-2">
							{provider.supported ? (
								connected && !editing ? (
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										aria-label={`Edit ${provider.name} API key`}
										onClick={() =>
											updateProviderEntry(provider.id, {
												editing: true,
												apiKey: '',
											})
										}
									>
										<Pencil className="size-3.5" />
									</Button>
								) : editing ? null : (
									<Button
										type="button"
										variant="outline"
										size="xs"
										onClick={() => updateProviderEntry(provider.id, { editing: true })}
									>
										Connect
									</Button>
								)
							) : (
								<Button type="button" variant="outline" size="xs" disabled>
									Soon
								</Button>
							)}
						</div>
					</div>

					{provider.supported && editing && entry ? (
						<div className="flex items-center gap-2 px-3 pb-3">
							<Input
								aria-label={`${provider.name} API key`}
								autoComplete="off"
								className="h-8 flex-1 rounded-md border-input bg-card px-2.5 text-xs font-semibold placeholder:text-muted-foreground"
								disabled={savingThisProvider}
								onChange={(event) => handleProviderApiKeyChange(provider.id, event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' && canSaveProvider) {
										void (kind === 'search'
											? saveSearchEntry(provider.id)
											: saveProviderEntry(provider.id, kind));
									}
								}}
								placeholder={t('settings.providers.apiKeyPlaceholder')}
								spellCheck={false}
								type="password"
								value={entry.apiKey}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={savingThisProvider}
								onClick={() => updateProviderEntry(provider.id, { apiKey: '', editing: false })}
							>
								{t('common.cancel')}
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={!canSaveProvider}
								onClick={() =>
									void (kind === 'search'
										? saveSearchEntry(provider.id)
										: saveProviderEntry(provider.id, kind))
								}
							>
								{savingThisProvider ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
								{t('common.save')}
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>
		);
	};

	const modelCatalog = actionableProviderCatalog();
	const featuredIds = new Set<string>(FEATURED_PROVIDER_IDS);
	const featuredProviders = FEATURED_PROVIDER_IDS.flatMap((id) =>
		modelCatalog.filter((provider) => provider.id === id)
	);
	const otherProviders = modelCatalog.filter((provider) => !featuredIds.has(provider.id));
	const searchCatalog = actionableSearchCatalog();
	const mcpCatalog = mcps();
	const catalogMcpIds = new Set(mcpCatalog.map((service) => service.id));
	const customMcpServers = Object.entries(mcpServers).filter(([id]) => !catalogMcpIds.has(id)) as [
		string,
		McpData,
	][];
	const saveCustomMcpServer = async (id: string, entry: McpData): Promise<void> => {
		await window.mcp.upsert(id, entry);
		await loadMcpServers();
		setAddingCustomMcp(false);
	};
	const removeCustomMcpServer = async (id: string): Promise<void> => {
		await window.mcp.delete(id);
		await loadMcpServers();
	};

	return (
		<SettingsPageShell className={embedded ? 'max-w-none p-0 sm:p-0' : undefined}>
			{!embedded && (
				<SettingsPageHeader
					title={t(section ? SECTION_HEADERS[section].titleKey : 'settings.tabs.providers')}
					description={t(
						section
							? SECTION_HEADERS[section].descriptionKey
							: 'settings.overview.descriptions.providers'
					)}
				/>
			)}
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{vaultWarning && (
				<SettingsNotice icon={AlertTriangle}>{vaultWarning}</SettingsNotice>
			)}
			{(section === undefined || section === 'models') &&
				(!embedded || modelCatalog.length > 0) && (
					<SettingsSection title={t('settings.overview.groups.mlModels')}>
						{embedded ? (
							<div className="space-y-3 pb-4">
								{featuredProviders.map((provider) => renderProviderCard(provider, 'models'))}
								{otherProviders.map((provider) => renderProviderCard(provider, 'models'))}
							</div>
						) : (
							<div className="space-y-3 pb-4">
								{actionableProviderCatalog().map((provider) =>
									renderProviderCard(provider, 'models')
								)}
							</div>
						)}
					</SettingsSection>
				)}

			{(section === undefined || section === 'search') &&
				(!embedded || searchCatalog.length > 0) && (
					<SettingsSection title="Search">
						<div className="space-y-3 pb-4">
							{searchCatalog.map((provider) => renderProviderCard(provider, 'search'))}
						</div>
					</SettingsSection>
				)}


			{(section === undefined || section === 'mcp') && mcpCatalog.length > 0 && (
				<SettingsSection title="Default MCP">
					<div className="space-y-3 pb-4">
						{mcpCatalog.map((service) => (
							<McpCard key={`${service.provider.id}-${service.id}`} service={service} />
						))}
					</div>
				</SettingsSection>
			)}

			{section === 'mcp' && (
				<SettingsSection
					title="Custom MCP"
					action={
						<Button
							variant="outline"
							size="sm"
							disabled={addingCustomMcp}
							onClick={() => setAddingCustomMcp(true)}
						>
							<Plus className="size-3.5" />
							Add custom server
						</Button>
					}
				>
					<div className="space-y-3 pb-4">
						{addingCustomMcp && (
							<Card size="sm" className="p-3!">
								<McpServerForm
									onSubmit={saveCustomMcpServer}
									onCancel={() => setAddingCustomMcp(false)}
								/>
							</Card>
						)}
						{!addingCustomMcp && customMcpServers.length === 0 && (
							<div className="px-0.5 text-[13px] text-muted-foreground">
								No custom MCP servers configured.
							</div>
						)}
						{customMcpServers.map(([id, entry]) => (
							<CustomMcpCard
								key={id}
								id={id}
								entry={entry}
								onSave={saveCustomMcpServer}
								onRemove={removeCustomMcpServer}
							/>
						))}
					</div>
				</SettingsSection>
			)}
		</SettingsPageShell>
	);
};

export default ProvidersPage;
