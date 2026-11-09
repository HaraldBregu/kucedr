import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	ChevronRight,
	CircleAlert,
	CircleCheck,
	CircleOff,
	Download,
	Hash,
	KeyRound,
	MoreHorizontal,
	Package,
	Plug,
	Tag,
	Trash2,
	User,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CatalogModel } from '@shared/model_types';
import type { PluginInfo, PluginScriptInfo } from '@shared/plugin_types';
import type { CatalogService, CatalogStorage, CatalogWebSearch } from '@shared/provider_types';
import type { App } from '@shared/installed_app_types';
import type { McpServerInfo } from '@shared/mcp_types';
import type { SkillInfo } from '@shared/skills_types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { handleExternalLinkClick } from '@/lib/external-links';
import { Input } from '@/components/ui/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { SettingsItemMedia } from '../../components/item-media';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
	SettingsValue,
} from '../../components';
import Confirm from './Confirm';
import Meta from './Meta';
import PluginIcon from './PluginIcon';

interface Contents {
	readonly models: readonly CatalogModel[];
	readonly mcps: readonly CatalogService[];
	readonly vectorDatabases: readonly CatalogService[];
	readonly webSearches: readonly CatalogWebSearch[];
	readonly storages: readonly CatalogStorage[];
	readonly apps: readonly App[];
	readonly servers: readonly McpServerInfo[];
	readonly skills: readonly SkillInfo[];
	readonly scripts: readonly PluginScriptInfo[];
}

interface Row {
	readonly key: string;
	readonly title: string;
	readonly description?: string;
	readonly badge?: string;
	readonly path?: string;
}

export default function PluginPage(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { pluginId } = useParams<{ pluginId: string }>();
	const [plugin, setPlugin] = useState<PluginInfo | null | undefined>(undefined);
	const [contents, setContents] = useState<Contents | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [confirming, setConfirming] = useState(false);
	const [settings, setSettings] = useState<Record<string, string>>({});
	const [editingSetting, setEditingSetting] = useState<string | null>(null);
	const savedSettings = useRef<Record<string, string>>({});

	const load = useCallback(async (): Promise<void> => {
		const [
			plugins,
			models,
			modelProviders,
			mcps,
			vectorDatabases,
			webSearches,
			storages,
			apps,
			registry,
			skills,
			scripts,
			values,
		] = await Promise.all([
			window.plugins.list(),
			window.app.models(),
			window.provider.getModelProviders(),
			window.app.mcps(),
			window.app.vectorDatabases(),
			window.services.list(),
			window.app.storages(),
			window.apps.list(),
			window.mcp.registry(),
			window.skills.list(),
			window.scripts.list(),
			window.plugins.getSettings(pluginId ?? ''),
		]);
		const owned = <T extends { readonly provider: { readonly plugin?: { readonly id: string } } }>(
			entries: readonly T[]
		): T[] => entries.filter((entry) => entry.provider.plugin?.id === pluginId);
		setPlugin(plugins.find((item) => item.id === pluginId) ?? null);
		setSettings(values);
		savedSettings.current = values;
		setContents({
			models: owned(models),
			mcps: owned(mcps),
			vectorDatabases: owned(vectorDatabases),
			webSearches: owned(webSearches),
			storages: owned(storages),
			apps: apps.filter((app) => app.plugin?.id === pluginId),
			servers: registry.servers.filter((server) => server.plugin?.id === pluginId),
			skills: skills.filter((skill) => skill.plugin?.id === pluginId),
			scripts: scripts.filter((script) => script.plugin.id === pluginId),
		});
		const ownedModels = owned(models);
		const ownedProviders = new Map(
			modelProviders
				.filter((provider) => provider.plugin?.id === pluginId)
				.map((provider) => [provider.id, provider])
		);
		const liveModels = (
			await Promise.all(
				[...ownedProviders.values()].map(async (provider) =>
					(await window.provider.listModels(provider.id).catch(() => [])).map(
						(model): CatalogModel => ({ ...model, type: 'llm', location: 'remote', provider })
					)
				)
			)
		)
			.flat()
			.filter((model) => !ownedModels.some((entry) => entry.id === model.id));
		if (liveModels.length > 0)
			setContents((current) => current && { ...current, models: [...ownedModels, ...liveModels] });
	}, [pluginId]);

	useEffect(() => {
		load().catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
	}, [load]);

	const run = async (action: () => Promise<void>, after?: () => void): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			await action();
			if (after) after();
			else await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const saveSetting = async (key: string): Promise<void> => {
		if (!plugin) return;
		const next = {
			...savedSettings.current,
			[key]: settings[key]?.trim() || savedSettings.current[key],
		};
		setBusy(true);
		setError('');
		try {
			await window.plugins.saveSettings(plugin.id, next);
			savedSettings.current = next;
			setSettings(next);
			setEditingSetting(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const resetSetting = async (key: string): Promise<void> => {
		if (!plugin) return;
		const next = { ...savedSettings.current };
		delete next[key];
		setBusy(true);
		setError('');
		try {
			await window.plugins.saveSettings(plugin.id, next);
			savedSettings.current = next;
			setSettings(next);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	if (plugin === undefined || !contents) {
		return (
			<SettingsPageShell>
				{error ? (
					<SettingsNotice variant="destructive">{error}</SettingsNotice>
				) : (
					<SettingsPanel>
						<SettingsLoadingRows rows={3} />
					</SettingsPanel>
				)}
			</SettingsPageShell>
		);
	}

	if (plugin === null) {
		return (
			<SettingsPageShell>
				<SettingsEmptyState
					icon={Plug}
					title={t('settings.integrations.plugin.notFound')}
					description={t('settings.integrations.plugin.notFoundDescription')}
				/>
			</SettingsPageShell>
		);
	}

	const details = [
		{ key: 'id', title: t('settings.integrations.plugin.id'), icon: Hash, value: plugin.id },
		{
			key: 'author',
			title: t('settings.integrations.plugin.author'),
			icon: User,
			value: plugin.author,
		},
		{
			key: 'source',
			title: t('settings.integrations.plugin.source'),
			icon: plugin.builtIn ? Package : Download,
			value: plugin.builtIn
				? t('settings.integrations.installed.builtInTitle')
				: t('settings.integrations.installed.downloadedTitle'),
		},
		{
			key: 'status',
			title: t('settings.integrations.plugin.status'),
			icon: plugin.error ? CircleAlert : plugin.enabled ? CircleCheck : CircleOff,
			value: plugin.error
				? t('settings.integrations.installed.unavailable')
				: plugin.enabled
					? t('settings.integrations.plugin.enabled')
					: t('settings.integrations.plugin.disabled'),
		},
	].filter((row) => row.value);

	const sections: { key: string; title: string; rows: Row[] }[] = [
		{
			key: 'models',
			title: t('settings.integrations.plugin.models'),
			rows: contents.models.map((model) => ({
				key: `${model.type}/${model.id}`,
				title: model.name,
				description: model.id,
				badge: t(`settings.integrations.plugin.capabilities.${model.type}`),
			})),
		},
		{
			key: 'remoteMcp',
			title: t('settings.integrations.plugin.remoteMcp'),
			rows: contents.mcps.map((service) => ({
				key: service.id,
				title: service.name,
				description: service.description ?? service.url,
			})),
		},
		{
			key: 'vectorDatabases',
			title: t('settings.integrations.plugin.vectorDatabases'),
			rows: contents.vectorDatabases.map((service) => ({
				key: service.id,
				title: service.name,
				description: service.description,
			})),
		},
		{
			key: 'services',
			title: t('settings.integrations.plugin.services'),
			rows: contents.webSearches.map((service) => ({
				key: service.id,
				title: service.name,
				description: service.description,
			})),
		},
		{
			key: 'apps',
			title: t('settings.integrations.plugin.apps'),
			rows: contents.apps.map((app) => ({
				key: app.id,
				title: app.title,
				description: app.description,
				badge: app.metadata.version,
				path: `/settings/apps/${encodeURIComponent(app.id)}`,
			})),
		},
		{
			key: 'mcp',
			title: t('settings.integrations.plugin.mcp'),
			rows: contents.servers.map((server) => ({
				key: server.id,
				title: server.data.name ?? server.id,
				description: server.diagnostic ?? server.id,
				badge: server.data.type,
			})),
		},
		{
			key: 'skills',
			title: t('settings.integrations.plugin.skills'),
			rows: contents.skills.map((skill) => ({
				key: skill.id,
				title: skill.name,
				description: skill.description,
				path: `/settings/skills/skilldetails/${encodeURIComponent(skill.id)}`,
			})),
		},
		{
			key: 'scripts',
			title: t('settings.integrations.plugin.scripts'),
			rows: contents.scripts.map((script) => ({
				key: script.name,
				title: script.title,
				description: script.name,
				badge: script.version,
				path:
					script.type !== 'UI'
						? `/settings/scripts/${encodeURIComponent(script.name)}`
						: undefined,
			})),
		},
	].filter((section) => section.rows.length > 0);

	return (
		<SettingsPageShell>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<header className="mb-6 flex items-start gap-4 py-2">
				<div className="min-w-0 flex-1">
					<div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-muted/50 p-2">
						<PluginIcon plugin={plugin} className="size-full" />
					</div>
					<h1 className="flex flex-wrap items-center gap-2 text-3xl font-normal leading-9 text-foreground">
						{plugin.name}
						{plugin.error && (
							<Badge variant="destructive">
								{t('settings.integrations.installed.unavailable')}
							</Badge>
						)}
					</h1>
					<p className="mt-1.5 max-w-2xl text-base leading-5 text-muted-foreground">
						{plugin.error ?? plugin.description}
					</p>
					<Meta rows={details} />
					{plugin.website && (
						<a
							href={plugin.website}
							onClick={handleExternalLinkClick}
							className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
						>
							{t('settings.integrations.plugin.website')}
						</a>
					)}
					{plugin.core && (
						<p className="mt-2 text-sm text-muted-foreground">
							{t('settings.integrations.plugin.core')}
						</p>
					)}
					{!plugin.builtIn && (
						<div className="mt-4 flex items-center gap-1.5">
							<Button
								type="button"
								size="sm"
								variant={plugin.enabled ? 'outline' : 'default'}
								disabled={busy || Boolean(plugin.error)}
								onClick={() =>
									void run(() => window.plugins.setEnabled(plugin.id, !plugin.enabled))
								}
							>
								{plugin.enabled
									? t('settings.integrations.installed.disable')
									: t('settings.integrations.installed.enableAction')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={busy}
								onClick={() => setConfirming(true)}
							>
								<Trash2 />
								{t('settings.integrations.plugin.remove')}
							</Button>
						</div>
					)}
				</div>
				{plugin.version && (
					<Badge
						variant="outline"
						className="shrink-0"
						title={t('settings.integrations.plugin.version')}
					>
						<Tag />
						{plugin.version}
					</Badge>
				)}
			</header>
			<div className="flex flex-col gap-8 pb-8">
				<SettingsSection title={t('settings.modelServices.configuration')}>
					{Object.keys(plugin.settings?.inputSchema?.properties ?? {}).length > 0 ? (
						<>
							<SettingsPanel>
								{Object.entries(plugin.settings?.inputSchema?.properties ?? {}).map(
									([key, setting]) => (
										<Item
											key={key}
											variant="ghost"
											size="md"
											className="min-w-0 gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
										>
											<SettingsItemMedia>
												<KeyRound className="size-5" aria-hidden="true" />
											</SettingsItemMedia>
											<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
												<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
													{setting.title ?? key}
												</ItemTitle>
												<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
													{t(
														savedSettings.current[key]?.trim()
															? 'settings.providers.configured'
															: 'settings.providers.notConfigured'
													)}
												</p>
											</ItemContent>
											<ItemActions className="ml-auto flex-none justify-end gap-2">
												{editingSetting === key ? (
													<>
														<Input
															autoFocus
															aria-label={setting.title ?? key}
															className="h-8 w-52 min-w-0 flex-1 rounded-md border-input bg-card px-2.5 text-xs font-semibold placeholder:text-muted-foreground sm:flex-none"
															type={setting.format === 'password' ? 'password' : 'text'}
															autoComplete="off"
															spellCheck={false}
															placeholder={
																savedSettings.current[key]
																	? '************'
																	: t('settings.providers.apiKeyPlaceholder')
															}
															value={settings[key] ?? ''}
															onChange={(event) =>
																setSettings((current) => ({
																	...current,
																	[key]: event.target.value,
																}))
															}
															onKeyDown={(event) => {
																if (
																	event.key === 'Enter' &&
																	(settings[key]?.trim() || savedSettings.current[key]?.trim())
																) {
																	event.preventDefault();
																	void saveSetting(key);
																}
															}}
														/>
														<Button
															type="button"
															variant="outline"
															size="sm"
															disabled={busy}
															onClick={() => {
																setSettings(savedSettings.current);
																setEditingSetting(null);
															}}
														>
															{t('common.cancel')}
														</Button>
														<Button
															type="button"
															size="sm"
															disabled={
																busy ||
																!(settings[key]?.trim() || savedSettings.current[key]?.trim())
															}
															onClick={() => void saveSetting(key)}
														>
															{t('common.save')}
														</Button>
													</>
												) : !savedSettings.current[key] ? (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => {
															setSettings((current) => ({ ...current, [key]: '' }));
															setEditingSetting(key);
														}}
													>
														Connect
													</Button>
												) : (
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="icon-sm"
																disabled={busy}
																aria-label={`Options for ${setting.title ?? key}`}
															>
																<MoreHorizontal className="size-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																onSelect={() => {
																	setSettings((current) => ({ ...current, [key]: '' }));
																	setEditingSetting(key);
																}}
															>
																Edit API key
															</DropdownMenuItem>
															<DropdownMenuItem onSelect={() => void resetSetting(key)}>
																Reset
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												)}
											</ItemActions>
										</Item>
									)
								)}
							</SettingsPanel>
						</>
					) : (
						<SettingsPanel>
							<p className="px-4 py-3 text-sm text-muted-foreground">
								{t('settings.apps.noConfiguration')}
							</p>
						</SettingsPanel>
					)}
				</SettingsSection>
				{!plugin.enabled && !plugin.error ? (
					<SettingsNotice>{t('settings.integrations.plugin.disabledNotice')}</SettingsNotice>
				) : (
					sections.map((section) => (
						<SettingsSection
							key={section.key}
							title={
								section.rows.length < 5
									? section.title
									: `${section.title} · ${section.rows.length}`
							}
						>
							<SettingsPanel>
								{section.rows.map((row) => (
									<SettingsRow
										key={row.key}
										title={row.title}
										description={row.description}
										onClick={row.path ? () => navigate(row.path!) : undefined}
									>
										<div className="flex items-center gap-2">
											{row.badge && <SettingsValue>{row.badge}</SettingsValue>}
											{row.path && <ChevronRight className="size-4 text-muted-foreground" />}
										</div>
									</SettingsRow>
								))}
							</SettingsPanel>
						</SettingsSection>
					))
				)}
			</div>
			<Confirm
				name={plugin.name}
				open={confirming}
				disabled={busy}
				onCancel={() => setConfirming(false)}
				onConfirm={() => {
					setConfirming(false);
					void run(
						() => window.plugins.remove(plugin.id),
						() => navigate('/settings/plugins')
					);
				}}
			/>
		</SettingsPageShell>
	);
}
