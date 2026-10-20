import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, PlugZap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { McpData, McpRegistry } from '@shared/mcp_types';
import type { CatalogService } from '@shared/provider_types';
import { Button } from '@/components/ui/button';
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
import { McpServerRow } from './components/McpServerRow';

const McpPage = (): React.JSX.Element => {
	const navigate = useNavigate();
	const [registry, setRegistry] = useState<McpRegistry>({ servers: [], diagnostics: [] });
	const [loading, setLoading] = useState(true);
	const [addingServer, setAddingServer] = useState(false);
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [catalog, setCatalog] = useState<readonly CatalogService[]>([]);
	const [connecting, setConnecting] = useState<CatalogService | null>(null);

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

			{loading ? (
				<SettingsLoadingRows rows={2} />
			) : servers.length === 0 ? (
				<SettingsEmptyState
					icon={PlugZap}
					title="No MCP servers"
					description="Add a server or upload a local package to make its tools available to Kucedr."
				/>
			) : (
				<div className="-mx-4 grid grid-cols-1 gap-y-3 pb-4">
					{servers.map((server) => (
						<McpServerRow
							key={server.id}
							server={server}
							onOpen={() => navigate(`/settings/mcp/${encodeURIComponent(server.id)}`)}
							onEnabledChange={async (enabled) => {
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
									// The row keeps its previous state when saving fails.
								} finally {
									setSavingId(null);
								}
							}}
							saving={savingId === server.id}
						/>
					))}
				</div>
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
