import React, { useEffect, useState } from 'react';
import {
	AlertTriangle,
	ExternalLink,
	LoaderCircle,
	MoreHorizontal,
	Pencil,
	Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProviderAvatar } from '@/components/provider-avatar';
import ollamaDarkLogo from '@resources/providers/ollama/images/ollama-dark.svg';
import ollamaLightLogo from '@resources/providers/ollama/images/ollama-light.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import { openExternalUrl } from '@/lib/external-links';
import { cn } from '@/lib/utils';
import type { StoredProviderKind } from '@shared/provider_types';
import type { SearchEngineId, SearchSettings } from '@shared/search_types';
import type { McpData } from '@shared/mcp_types';
import { databaseCatalog } from './database';
import { mcps } from '@/lib/providers';
import {
	actionableProviderCatalog,
	actionableSearchCatalog,
	getErrorMessage,
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

type ProviderKind = Exclude<StoredProviderKind, 'channels'> | 'search';
export type ProviderSetupSection = 'models' | 'search' | 'mcp' | 'databases';

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
		databases: {
			titleKey: 'settings.tabs.databases',
			descriptionKey: 'settings.overview.descriptions.databases',
		},
		mcp: {
			titleKey: 'settings.tabs.mcp',
			descriptionKey: 'settings.overview.descriptions.mcp',
		},
	};

/** Providers pinned on top of the start-flow models list. */
const FEATURED_PROVIDER_IDS = ['openai', 'anthropic', 'deepseek', 'elevenlabs'] as const;

function allCatalogItems(section?: ProviderSetupSection): readonly ProviderCatalogItem[] {
	if (section === 'databases') return databaseCatalog();
	return [...actionableProviderCatalog(), ...actionableSearchCatalog()];
}

interface ProvidersPageProps {
	readonly embedded?: boolean;
	readonly section?: ProviderSetupSection;
}

const ProvidersPage: React.FC<ProvidersPageProps> = ({ embedded = false, section }) => {
	const { t } = useTranslation();
	const [providerEntries, setProviderEntries] = useState<ProviderSetupEntry[]>(() =>
		allCatalogItems(section).map((provider) => ({
			providerId: provider.id,
			apiKey: '',
			savedApiKey: '',
			apiKeySaved: false,
			editing: false,
		}))
	);
	const [customProvider, setCustomProvider] = useState({
		apiKey: '',
		baseUrl: '',
		savedApiKey: '',
		savedBaseUrl: '',
		editing: false,
	});
	const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [searchSettings, setSearchSettings] = useState<SearchSettings | null>(null);
	const [addingCustomMcp, setAddingCustomMcp] = useState(false);
	const { servers: mcpServers, load: loadMcpServers } = useMcpServers();

	useEffect(() => {
		let cancelled = false;

		void Promise.all([
			window.provider.list(section === 'databases' ? 'databases' : 'models'),
			window.search.listProviders(),
		])
			.then(([storedProviders, storedSearchProviders]) => {
				if (cancelled) return;
				const savedProviders = new Map(
					[...storedProviders, ...storedSearchProviders].map((provider) => [provider.id, provider])
				);
				setProviderEntries((currentEntries) =>
					allCatalogItems(section).map((provider) => {
						const current = currentEntries.find((entry) => entry.providerId === provider.id);
						const savedApiKey = savedProviders.get(provider.id)?.apiKey ?? '';
						const saved = Boolean(savedApiKey.trim());

						return {
							providerId: provider.id,
							apiKey: current?.apiKey || savedApiKey,
							savedApiKey,
							apiKeySaved: saved,
							editing: saved && !current?.savedApiKey ? false : (current?.editing ?? false),
						};
					})
				);
				const custom = savedProviders.get('custom');
				if (custom?.baseUrl) {
					setCustomProvider({
						apiKey: custom.apiKey,
						baseUrl: custom.baseUrl,
						savedApiKey: custom.apiKey,
						savedBaseUrl: custom.baseUrl,
						editing: false,
					});
				}
			})
			.catch((err) => {
				if (cancelled) return;
				setError(getErrorMessage(err, 'Could not check saved provider access.'));
			});
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
	}, [section]);

	const updateProviderEntry = (providerId: string, patch: Partial<ProviderSetupEntry>): void => {
		setProviderEntries((currentEntries) => {
			if (!currentEntries.some((entry) => entry.providerId === providerId)) {
				return [
					...currentEntries,
					{
						providerId,
						apiKey: '',
						savedApiKey: '',
						apiKeySaved: false,
						editing: false,
						...patch,
					},
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
		kind: Exclude<StoredProviderKind, 'channels'>
	): Promise<void> => {
		const entry = providerEntries.find((item) => item.providerId === providerId);
		const apiKey = entry?.apiKey.trim() || entry?.savedApiKey.trim() || '';
		if (!entry || !apiKey) return;

		setSavingProviderId(providerId);
		setError(null);
		try {
			await window.provider.set({ id: providerId, apiKey, kind });
			updateProviderEntry(providerId, {
				apiKey,
				savedApiKey: apiKey,
				apiKeySaved: true,
				editing: false,
			});
		} catch (err) {
			setError(getErrorMessage(err, 'Could not save provider API key.'));
		} finally {
			setSavingProviderId(null);
		}
	};

	const saveSearchEntry = async (providerId: string): Promise<void> => {
		const entry = providerEntries.find((item) => item.providerId === providerId);
		const apiKey = entry?.apiKey.trim() || entry?.savedApiKey.trim() || '';
		if (!entry || !apiKey) return;

		setSavingProviderId(providerId);
		setError(null);
		try {
			setSearchSettings(await window.search.saveEngine(providerId as SearchEngineId, { apiKey }));
			updateProviderEntry(providerId, {
				apiKey,
				savedApiKey: apiKey,
				apiKeySaved: true,
				editing: false,
			});
		} catch (err) {
			setError(getErrorMessage(err, 'Could not save search provider API key.'));
		} finally {
			setSavingProviderId(null);
		}
	};

	const saveCustomProvider = async (): Promise<void> => {
		const apiKey = customProvider.apiKey.trim() || customProvider.savedApiKey;
		const baseUrl = customProvider.baseUrl.trim();
		if (!apiKey || !baseUrl) return;
		setSavingProviderId('custom');
		setError(null);
		try {
			await window.provider.set({ id: 'custom', kind: 'models', apiKey, baseUrl });
			setCustomProvider({
				apiKey,
				baseUrl,
				savedApiKey: apiKey,
				savedBaseUrl: baseUrl,
				editing: false,
			});
		} catch (err) {
			setError(getErrorMessage(err, 'Could not save custom model provider.'));
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
		const canSaveProvider =
			!!entry && !savingThisProvider && Boolean(entry.apiKey.trim() || entry.savedApiKey.trim());
		if (kind === 'models') {
			return (
				<Item
					key={provider.id}
					variant="ghost"
					size="md"
					className={cn(
						'min-w-0 gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50',
						!provider.supported && 'opacity-70'
					)}
				>
					<ProviderAvatar
						providerId={provider.id}
						name={provider.name}
						iconDarkUrl={provider.iconDarkUrl}
						iconLightUrl={provider.iconLightUrl}
						className="size-9 rounded-2xl border-0 bg-muted/50 p-1.5 group-hover/item:bg-transparent group-focus-within/item:bg-transparent"
					/>
					<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
						<div className="flex min-w-0 max-w-full items-center gap-1.5">
							<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
								<h2>{provider.name}</h2>
							</ItemTitle>
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
						<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
							{t(connected ? 'settings.providers.configured' : 'settings.providers.notConfigured')}
						</p>
					</ItemContent>
					<ItemActions
						className={cn('ml-auto flex-none justify-end gap-2', editing && 'w-full sm:w-auto')}
					>
						{editing && entry ? (
							<>
								<Input
									aria-label={`${provider.name} API key`}
									autoComplete="off"
									className="h-8 w-52 min-w-0 flex-1 rounded-md border-input bg-card px-2.5 text-xs font-semibold placeholder:text-muted-foreground sm:flex-none"
									disabled={savingThisProvider}
									onChange={(event) => handleProviderApiKeyChange(provider.id, event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter' && canSaveProvider) {
											void saveProviderEntry(provider.id, 'models');
										}
									}}
									placeholder={
										entry.savedApiKey ? '************' : t('settings.providers.apiKeyPlaceholder')
									}
									spellCheck={false}
									type="text"
									value={entry.apiKey}
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={savingThisProvider}
									onClick={() =>
										updateProviderEntry(provider.id, { apiKey: entry.savedApiKey, editing: false })
									}
								>
									{t('common.cancel')}
								</Button>
								<Button
									type="button"
									size="sm"
									disabled={!canSaveProvider}
									onClick={() => void saveProviderEntry(provider.id, 'models')}
								>
									{savingThisProvider && <LoaderCircle className="size-3.5 animate-spin" />}
									{t('common.save')}
								</Button>
							</>
						) : !provider.supported ? (
							<Button type="button" variant="ghost" size="sm" disabled>
								Soon
							</Button>
						) : !connected ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => updateProviderEntry(provider.id, { editing: true, apiKey: '' })}
							>
								Connect
							</Button>
						) : (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										className="hover:bg-transparent dark:hover:bg-transparent"
										disabled={savingThisProvider}
										aria-label={`Options for ${provider.name}`}
									>
										<MoreHorizontal className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onSelect={() => updateProviderEntry(provider.id, { editing: true, apiKey: '' })}
									>
										Edit API key
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</ItemActions>
				</Item>
			);
		}

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
							'grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3.5',
							editing && kind === 'databases' && 'pb-3',
								editing &&
									kind === 'search' &&
								'sm:grid-cols-[2rem_minmax(0,1fr)_minmax(21rem,26rem)]'
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
								{t(
									connected ? 'settings.providers.configured' : 'settings.providers.notConfigured'
								)}
							</p>
						</div>
						<div className="flex min-w-0 shrink-0 justify-end gap-2">
							{provider.supported ? (
									editing && kind === 'search' && entry ? (
									<>
										<Input
											aria-label={`${provider.name} API key`}
											autoComplete="off"
											className="h-8 min-w-0 flex-1 rounded-md border-input bg-card px-2.5 text-xs font-semibold placeholder:text-muted-foreground"
											disabled={savingThisProvider}
											onChange={(event) =>
												handleProviderApiKeyChange(provider.id, event.target.value)
											}
											onKeyDown={(event) => {
												if (event.key === 'Enter' && canSaveProvider) {
													void (kind === 'search'
														? saveSearchEntry(provider.id)
														: saveProviderEntry(provider.id, kind));
												}
											}}
											placeholder={
												entry.savedApiKey
													? '************'
													: t('settings.providers.apiKeyPlaceholder')
											}
											spellCheck={false}
											type="text"
											value={entry.apiKey}
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={savingThisProvider}
											onClick={() =>
												updateProviderEntry(provider.id, {
													apiKey: entry.savedApiKey,
													editing: false,
												})
											}
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
											{savingThisProvider ? (
												<LoaderCircle className="size-3.5 animate-spin" />
											) : null}
											{t('common.save')}
										</Button>
									</>
								) : connected && !editing ? (
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

					{provider.supported && editing && entry && kind === 'databases' ? (
						<div className="flex items-center gap-2 px-4 pb-4">
							<Input
								aria-label={`${provider.name} API key`}
								autoComplete="off"
								className="h-8 flex-1 rounded-md border-input bg-card px-2.5 text-xs font-semibold placeholder:text-muted-foreground"
								disabled={savingThisProvider}
								onChange={(event) => handleProviderApiKeyChange(provider.id, event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' && canSaveProvider) {
										void saveProviderEntry(provider.id, kind);
									}
								}}
								placeholder={
									entry.savedApiKey ? '************' : t('settings.providers.apiKeyPlaceholder')
								}
								spellCheck={false}
								type="text"
								value={entry.apiKey}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={savingThisProvider}
								onClick={() =>
									updateProviderEntry(provider.id, {
										apiKey: entry.savedApiKey,
										editing: false,
									})
								}
							>
								{t('common.cancel')}
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={!canSaveProvider}
								onClick={() => void saveProviderEntry(provider.id, kind)}
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

	const renderCustomProviderCard = (): React.ReactElement => {
		const connected = Boolean(customProvider.savedBaseUrl);
		const saving = savingProviderId === 'custom';
		const canSave = Boolean(
			(customProvider.apiKey.trim() || customProvider.savedApiKey) && customProvider.baseUrl.trim()
		);
		return (
			<Item
				variant="ghost"
				size="md"
				className="min-w-0 gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
			>
				<div className="w-full">
					<div className={cn('flex min-h-9 items-center gap-3', customProvider.editing && 'pb-3')}>
						<ProviderAvatar
							providerId="ollama"
							name="Ollama"
							iconDarkUrl={ollamaDarkLogo}
							iconLightUrl={ollamaLightLogo}
							className="size-9 rounded-2xl border-0 bg-white p-1.5 dark:bg-white"
						/>
						<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
							<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
								<h3>{t('settings.providers.localModels.model')}</h3>
							</ItemTitle>
							<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
								{t(
									connected ? 'settings.providers.configured' : 'settings.providers.notConfigured'
								)}
							</p>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							{customProvider.editing ? null : !connected ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setCustomProvider((current) => ({ ...current, editing: true }))}
								>
									{t('settings.providers.localModels.connect')}
								</Button>
							) : (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										className="hover:bg-transparent dark:hover:bg-transparent"
										disabled={saving}
										aria-label="Options for Ollama"
									>
										<MoreHorizontal className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onSelect={() =>
											setCustomProvider((current) => ({ ...current, apiKey: '', editing: true }))
										}
									>
										{t('settings.providers.localModels.edit')}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							)}
						</ItemActions>
					</div>
					{customProvider.editing && (
						<div className="grid gap-3 pb-2">
							<div className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
								<Label htmlFor="local-model-url" className="sm:text-right">
									{t('settings.providers.localModels.url')}
								</Label>
								<Input
									id="local-model-url"
									autoComplete="off"
									className="h-8"
									disabled={saving}
									placeholder="http://localhost:11434/api"
									spellCheck={false}
									value={customProvider.baseUrl}
									onChange={(event) =>
										setCustomProvider((current) => ({
											...current,
											baseUrl: event.target.value,
										}))
									}
								/>
							</div>
							<div className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
								<Label htmlFor="local-model-token" className="sm:text-right">
									{t('settings.providers.localModels.token')}
								</Label>
								<Input
									id="local-model-token"
									autoComplete="off"
									className="h-8"
									disabled={saving}
									placeholder={customProvider.savedApiKey ? '************' : 'ollama'}
									spellCheck={false}
									type="text"
									value={customProvider.apiKey}
									onChange={(event) =>
										setCustomProvider((current) => ({
											...current,
											apiKey: event.target.value,
										}))
									}
								/>
							</div>
							<div className="flex gap-2 sm:ml-[10.75rem] sm:justify-end">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={saving}
									onClick={() =>
										setCustomProvider((current) => ({
											...current,
											apiKey: current.savedApiKey,
											baseUrl: current.savedBaseUrl,
											editing: false,
										}))
									}
								>
									{t('common.cancel')}
								</Button>
								<Button
									type="button"
									size="sm"
									disabled={saving || !canSave}
									onClick={() => void saveCustomProvider()}
								>
									{saving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
									{t('common.save')}
								</Button>
							</div>
						</div>
					)}
				</div>
			</Item>
		);
	};

	const modelCatalog = actionableProviderCatalog();
	const featuredIds = new Set<string>(FEATURED_PROVIDER_IDS);
	const featuredProviders = FEATURED_PROVIDER_IDS.flatMap((id) =>
		modelCatalog.filter((provider) => provider.id === id)
	);
	const otherProviders = modelCatalog.filter((provider) => !featuredIds.has(provider.id));
	const orderedModelProviders = [...featuredProviders, ...otherProviders];
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
			{(section === undefined || section === 'models') &&
				(!embedded || modelCatalog.length > 0) && (
					<SettingsSection title={t('settings.overview.groups.mlModels')}>
						<div className="-mx-4 grid grid-cols-1 gap-y-1 pb-4">
							{section === undefined && renderCustomProviderCard()}
							{orderedModelProviders.map((provider) => renderProviderCard(provider, 'models'))}
						</div>
					</SettingsSection>
				)}
			{section === 'models' && (
				<SettingsSection title={t('settings.modelServices.localModels')}>
					<div className="-mx-4 grid grid-cols-1 gap-y-1 pb-4">{renderCustomProviderCard()}</div>
				</SettingsSection>
			)}

			{section === 'databases' && (
				<SettingsSection title={t('settings.tabs.databases')}>
					<div className="space-y-3 pb-4">
						{databaseCatalog().map((provider) => renderProviderCard(provider, 'databases'))}
					</div>
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
							<Card size="sm" className="p-4!">
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
