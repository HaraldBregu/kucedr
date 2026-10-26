import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plug, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CatalogModel } from '@shared/model_types';
import type { PluginInfo } from '@shared/plugin_types';
import type { CatalogService, CatalogStorage, CatalogWebSearch } from '@shared/provider_types';
import type { App } from '@shared/installed_app_types';
import type { McpServerInfo } from '@shared/mcp_types';
import type { SkillInfo } from '@shared/skills_types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
}

interface Row {
	readonly key: string;
	readonly title: string;
	readonly description?: string;
	readonly badge?: string;
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

	const load = useCallback(async (): Promise<void> => {
		const [
			plugins,
			models,
			mcps,
			vectorDatabases,
			webSearches,
			storages,
			apps,
			registry,
			skills,
			values,
		] = await Promise.all([
				window.plugins.list(),
				window.app.models(),
				window.app.mcps(),
				window.app.vectorDatabases(),
				window.app.webSearches(),
				window.app.storages(),
				window.apps.list(),
				window.mcp.registry(),
				window.skills.list(),
				window.plugins.getSettings(pluginId ?? ''),
			]);
		const owned = <T extends { readonly provider: { readonly plugin?: { readonly id: string } } }>(
			entries: readonly T[]
		): T[] => entries.filter((entry) => entry.provider.plugin?.id === pluginId);
		setPlugin(plugins.find((item) => item.id === pluginId) ?? null);
		setSettings(values);
		setContents({
			models: owned(models),
			mcps: owned(mcps),
			vectorDatabases: owned(vectorDatabases),
			webSearches: owned(webSearches),
			storages: owned(storages),
			apps: apps.filter((app) => app.plugin?.id === pluginId),
			servers: registry.servers.filter((server) => server.plugin?.id === pluginId),
			skills: skills.filter((skill) => skill.plugin?.id === pluginId),
		});
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

	const back = (
		<Button
			variant="ghost"
			size="sm"
			className="w-fit"
			onClick={() => navigate('/settings/plugins')}
		>
			<ArrowLeft className="size-4" />
			{t('settings.integrations.title')}
		</Button>
	);

	if (plugin === undefined || !contents) {
		return (
			<SettingsPageShell>
				{back}
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
				{back}
				<SettingsEmptyState
					icon={Plug}
					title={t('settings.integrations.plugin.notFound')}
					description={t('settings.integrations.plugin.notFoundDescription')}
				/>
			</SettingsPageShell>
		);
	}

	const details = [
		{ key: 'id', title: t('settings.integrations.plugin.id'), value: plugin.id },
		{ key: 'author', title: t('settings.integrations.plugin.author'), value: plugin.author },
		{
			key: 'source',
			title: t('settings.integrations.plugin.source'),
			value: plugin.builtIn
				? t('settings.integrations.installed.builtInTitle')
				: t('settings.integrations.installed.downloadedTitle'),
		},
		{
			key: 'status',
			title: t('settings.integrations.plugin.status'),
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
			key: 'webSearch',
			title: t('settings.integrations.plugin.webSearch'),
			rows: contents.webSearches.map((service) => ({
				key: service.id,
				title: service.name,
				description: service.description,
			})),
		},
		{
			key: 'storage',
			title: t('settings.integrations.plugin.storage'),
			rows: contents.storages.map((service) => ({
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
			})),
		},
	].filter((section) => section.rows.length > 0);

	return (
		<SettingsPageShell>
			{back}
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<header className="mb-6 flex items-start gap-4 py-2">
				<PluginIcon plugin={plugin} className="size-14" />
				<div className="min-w-0 flex-1">
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
					{plugin.core && (
						<p className="mt-2 text-sm text-muted-foreground">
							{t('settings.integrations.plugin.core')}
						</p>
					)}
				</div>
				{plugin.version && (
					<Badge variant="outline" className="shrink-0">
						{t('settings.integrations.plugin.version')} {plugin.version}
					</Badge>
				)}
			</header>
			<div className="flex flex-col gap-8 pb-8">
				{plugin.settings.length > 0 && (
					<SettingsSection title={t('settings.integrations.plugin.settings')}>
						<form
							className="flex flex-col gap-3"
							onSubmit={(event) => {
								event.preventDefault();
								void run(() => window.plugins.saveSettings(plugin.id, settings));
							}}
						>
							<SettingsPanel>
								{plugin.settings.map((setting) => (
									<SettingsRow key={setting.key} title={setting.label}>
										<Input
											aria-label={setting.label}
											className="w-72"
											type={setting.type}
											required={setting.required}
											autoComplete="off"
											spellCheck={false}
											value={settings[setting.key] ?? ''}
											onChange={(event) =>
												setSettings((current) => ({
													...current,
													[setting.key]: event.target.value,
												}))
											}
										/>
									</SettingsRow>
								))}
							</SettingsPanel>
							<Button type="submit" size="sm" className="w-fit" disabled={busy}>
								{t('common.save')}
							</Button>
						</form>
					</SettingsSection>
				)}
				{!plugin.enabled && !plugin.error ? (
					<SettingsNotice>{t('settings.integrations.plugin.disabledNotice')}</SettingsNotice>
				) : (
					sections.map((section) => (
						<SettingsSection key={section.key} title={`${section.title} · ${section.rows.length}`}>
							<SettingsPanel>
								{section.rows.map((row) => (
									<SettingsRow key={row.key} title={row.title} description={row.description}>
										{row.badge && <SettingsValue>{row.badge}</SettingsValue>}
									</SettingsRow>
								))}
							</SettingsPanel>
						</SettingsSection>
					))
				)}
				{!plugin.builtIn && (
					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							size="sm"
							variant={plugin.enabled ? 'outline' : 'default'}
							disabled={busy || Boolean(plugin.error)}
							onClick={() => void run(() => window.plugins.setEnabled(plugin.id, !plugin.enabled))}
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
