import React, { useCallback, useEffect, useState } from 'react';
import {
	AlertTriangle,
	ChevronRight,
	Globe,
	HardDrive,
	Plug,
	Plus,
	PlugZap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { McpData, McpRegistry, McpServerInfo } from '@shared/mcp_types';
import type { CatalogService } from '@shared/provider_types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { catalogServer } from './catalog_server';
import { MicrosoftConnect } from './components/McpConnect';
import { McpServerForm } from './components/McpServerForm';
import { SettingsFilter } from '../../components/filter';

const McpPage = (): React.JSX.Element => {
	const navigate = useNavigate();
	const [registry, setRegistry] = useState<McpRegistry>({ servers: [], diagnostics: [] });
	const [loading, setLoading] = useState(true);
	const [addingServer, setAddingServer] = useState(false);
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [catalog, setCatalog] = useState<readonly CatalogService[]>([]);
	const [connecting, setConnecting] = useState<CatalogService | null>(null);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('all');

	const load = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError('');
		try {
			const [nextRegistry, nextCatalog] = await Promise.all([
				window.mcp.registry(),
				window.app.mcps(),
			]);
			setRegistry(nextRegistry);
			setCatalog(nextCatalog);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);

	const save = async (id: string, data: McpData): Promise<void> => {
		setError('');
		try {
			await window.mcp.upsert(id, data);
			await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			throw caught;
		}
	};

	const available = catalog.filter(
		(service) =>
			!registry.servers.some(
				(server) =>
					server.id === service.id ||
					(server.data.type === 'http' && server.data.url === service.url)
			)
	);

	const servers = [...registry.servers, ...available.map(catalogServer)];
	const categoryOf = (server: McpServerInfo): string =>
		server.data.type === 'http' ? 'remote' : 'local';
	const categories = [...new Set(servers.map(categoryOf))].sort();
	const visibleServers = servers.filter(
		(server) =>
			(category === 'all' || categoryOf(server) === category) &&
			`${server.data.name ?? ''} ${server.id}`.toLowerCase().includes(query.trim().toLowerCase())
	);

	const addService = async (
		service: CatalogService,
		configuration?: { readonly url: string; readonly clientId: string }
	): Promise<boolean> => {
		setSavingId(service.id);
		try {
			await save(service.id, {
				type: 'http',
				name: service.name,
				url: configuration?.url ?? service.url ?? '',
				...(configuration ? { client_id: configuration.clientId } : {}),
				enabled: true,
			});
			await window.mcp.test(service.id).catch(() => undefined);
			return true;
		} catch {
			return false;
		} finally {
			setSavingId(null);
		}
	};

	const setEnabled = async (server: McpServerInfo, enabled: boolean): Promise<void> => {
		const service = available.find((item) => item.id === server.id);
		if (service) {
			if (service.url?.includes('{tenantId}')) {
				setError('');
				setConnecting(service);
			} else await addService(service);
			return;
		}
		setSavingId(server.id);
		try {
			await save(server.id, { ...server.data, enabled });
		} catch {
			// The card keeps its previous state when saving fails.
		} finally {
			setSavingId(null);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title="MCP servers"
				description="Manage remote services and local MCP server packages."
				action={
					<Button size="xs" disabled={addingServer} onClick={() => setAddingServer(true)}>
						<Plus className="size-3" />
						Add server
					</Button>
				}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{registry.diagnostics.map((diagnostic) => (
				<SettingsNotice key={diagnostic.path} variant="destructive" icon={AlertTriangle}>
					{diagnostic.name}: {diagnostic.error}
				</SettingsNotice>
			))}

			{addingServer && (
				<SettingsSection title="Add MCP server">
					<SettingsPanel>
						<McpServerForm
							onSubmit={async (id, entry) => {
								await save(id, entry);
								setAddingServer(false);
							}}
							onCancel={() => setAddingServer(false)}
						/>
					</SettingsPanel>
				</SettingsSection>
			)}

			{!loading && servers.length === 0 && (
				<SettingsEmptyState
					icon={PlugZap}
					title="No MCP servers"
					description="Add a server or upload a local package to make its tools available to Kucedr."
				/>
			)}

			{(loading || servers.length > 0) && (
				<section className="pb-4" aria-labelledby="installed-mcp-title">
					<h2 id="installed-mcp-title" className="mb-2 text-sm font-medium">
						Installed servers
					</h2>
					<SettingsFilter
						query={query}
						onQueryChange={setQuery}
						categories={categories}
						category={category}
						onCategoryChange={setCategory}
					/>
					{loading ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={2} />
						</SettingsPanel>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{visibleServers.map((server) => {
								const title = server.data.name ?? server.id;
								const enabled = server.data.enabled !== false;
								const open = (): void =>
									void navigate(`/settings/mcp/${encodeURIComponent(server.id)}`);
								return (
									<Card
										key={server.id}
										size="sm"
										role="link"
										tabIndex={0}
										className="cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
										onClick={open}
										onKeyDown={(event) => {
											if (
												event.target === event.currentTarget &&
												(event.key === 'Enter' || event.key === ' ')
											) {
												event.preventDefault();
												open();
											}
										}}
									>
										<CardHeader className="flex flex-1 items-center gap-3">
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<CardTitle className="truncate">{title}</CardTitle>
												<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
													<span className="flex items-center gap-1">
														{server.data.type === 'http' ? (
															<Globe className="size-3" aria-hidden="true" />
														) : (
															<HardDrive className="size-3" aria-hidden="true" />
														)}
														{t(`settings.filter.categories.${categoryOf(server)}`)}
													</span>
													{server.plugin && (
														<span className="flex items-center gap-1">
															<Plug className="size-3" aria-hidden="true" />
															{server.plugin.name}
														</span>
													)}
												</div>
											</div>
											<Switch
												checked={enabled}
												disabled={savingId === server.id}
												onClick={(event) => event.stopPropagation()}
												onKeyDown={(event) => event.stopPropagation()}
												onCheckedChange={(checked) => void setEnabled(server, checked)}
												aria-label={`${enabled ? 'Disable' : 'Enable'} ${title}`}
											/>
											<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
										</CardHeader>
									</Card>
								);
							})}
						</div>
					)}
				</section>
			)}

			<MicrosoftConnect
				service={connecting}
				onClose={() => setConnecting(null)}
				onConnect={(url, clientId) =>
					connecting ? addService(connecting, { url, clientId }) : Promise.resolve(false)
				}
				saving={savingId === connecting?.id}
				error={error}
			/>
		</SettingsPageShell>
	);
};

export default McpPage;
