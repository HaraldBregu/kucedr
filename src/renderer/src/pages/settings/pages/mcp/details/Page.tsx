import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FlaskConical, Globe, HardDrive, Hash, Plug, RefreshCw } from 'lucide-react';
import type { McpData, McpServerInfo, McpTestResult, McpToolDetail } from '@shared/mcp_types';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../../components';
import type { AgentToolPermission } from '@shared/agent_tools';
import { catalogServer } from '../catalog_server';
import { McpServerForm } from '../components/McpServerForm';
import { ToolPermissionControl } from '../../assistant/tools/Permission';
import Meta from '../../plugins/Meta';

const McpDetailsPage: React.FC = () => {
	const navigate = useNavigate();
	const { mcpServerId } = useParams<{ mcpServerId: string }>();
	const id = mcpServerId ?? '';
	const [server, setServer] = useState<McpServerInfo | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [testResult, setTestResult] = useState<McpTestResult>();
	const [tools, setTools] = useState<readonly McpToolDetail[]>([]);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
	const [saved, setSaved] = useState(false);

	const load = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError('');
		try {
			const [registry, catalog, services] = await Promise.all([
				window.mcp.registry(),
				window.mcp.catalog(id),
				window.app.mcps(),
			]);
			const configured = registry.servers.find((entry) => entry.id === id);
			const service = services.find((entry) => entry.id === id);
			setSaved(Boolean(configured));
			setServer(configured ?? (service ? catalogServer(service) : null));
			setTools(catalog?.toolDetails ?? []);
		} catch (caught) {
			setServer(null);
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);

	const save = async (serverId: string, data: McpData): Promise<void> => {
		if (!server) return;
		setSaving(true);
		setError('');
		setSuccess('');
		setTestResult(undefined);
		try {
			if (server.source === 'local') {
				if (data.type !== 'stdio')
					throw new Error('Local MCP servers require stdio configuration.');
				setServer(await window.mcp.configureLocal(serverId, data));
			} else {
				await window.mcp.upsert(serverId, data);
				const registry = await window.mcp.registry();
				setServer(registry.servers.find((entry) => entry.id === serverId) ?? null);
				setSaved(true);
			}
			setTools((await window.mcp.catalog(serverId))?.toolDetails ?? []);
			setSuccess('MCP server saved.');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			throw caught;
		} finally {
			setSaving(false);
		}
	};

	const test = async (): Promise<void> => {
		if (!server) return;
		setTesting(true);
		setError('');
		try {
			const result = await window.mcp.test(server.id);
			setTestResult(result);
			if (result.ok) setTools(result.toolDetails ?? []);
		} catch (caught) {
			setTestResult({
				ok: false,
				tools: [],
				toolCount: 0,
				durationMs: 0,
				error: caught instanceof Error ? caught.message : String(caught),
			});
		} finally {
			setTesting(false);
		}
	};

	const setPermission = async (
		toolName: string,
		permission: AgentToolPermission
	): Promise<void> => {
		if (!server) return;
		setError('');
		try {
			await window.mcp.setToolPermission(server.id, toolName, permission);
			setTools((current) =>
				current.map((tool) => (tool.name === toolName ? { ...tool, permission } : tool))
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	};

	const remove = async (): Promise<void> => {
		if (!server || server.source !== 'configured' || !saved) return;
		setSaving(true);
		setError('');
		try {
			await window.mcp.delete(server.id);
			setConfirmRemoveOpen(false);
			navigate('/settings/mcp');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<SettingsPageShell>
				<SettingsPageHeader title="MCP server" />
				<SettingsPanel>
					<SettingsLoadingRows rows={4} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (!server) {
		return (
			<SettingsPageShell>
				<SettingsPageHeader title="MCP server" />
				{error && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{error}
					</SettingsNotice>
				)}
				<SettingsPanel>
					<SettingsEmptyState
						icon={Plug}
						title="Server not found"
						description="The MCP server may have been removed."
						className="min-h-28"
					/>
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	const title = server.data.name ?? server.id;
	const description =
		server.source === 'local'
			? (server.path ?? 'Filesystem package')
			: server.data.type === 'http'
				? server.data.url
				: 'Configured local command';

	return (
		<SettingsPageShell>
			<header className="mb-6 flex items-start gap-4 py-2">
				<div className="min-w-0 flex-1">
					<div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-muted/50 p-2 text-muted-foreground">
						<Plug className="size-6" aria-hidden="true" />
					</div>
					<h1 className="text-3xl font-normal leading-9 text-foreground">{title}</h1>
					<p className="mt-1.5 max-w-2xl break-all text-base leading-5 text-muted-foreground">{description}</p>
					<Meta rows={[
						{ key: 'id', title: 'ID', icon: Hash, value: server.id },
						{ key: 'type', title: 'Type', icon: server.data.type === 'http' ? Globe : HardDrive, value: server.data.type === 'http' ? 'Remote' : 'Local' },
						{ key: 'plugin', title: 'Plugin', icon: Plug, value: server.plugin?.name },
					].filter((row) => row.value)} />
				</div>
				<Switch
					checked={server.data.enabled !== false}
					disabled={saving || testing || (server.data.type === 'http' && server.data.url.includes('{tenantId}'))}
					onCheckedChange={(enabled) => void save(server.id, { ...server.data, enabled }).catch(() => undefined)}
					aria-label={`${server.data.enabled === false ? 'Enable' : 'Disable'} ${title}`}
				/>
			</header>

			{!saved && (
				<SettingsNotice>
					{server.data.type === 'http' && server.data.url.includes('{tenantId}')
						? 'Provided by a plugin. Replace {tenantId} in the URL with your tenant ID, add the client ID, then save to add it.'
						: 'Provided by a plugin and not added yet. Turn it on or save the configuration to add it.'}
				</SettingsNotice>
			)}
			{server.data.type === 'stdio' && (
				<SettingsNotice>
					Save, enable or test only local server commands you trust. They run with your desktop
					account&apos;s privileges.
				</SettingsNotice>
			)}
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{success && <SettingsNotice autoDismiss>{success}</SettingsNotice>}
			{server.diagnostic && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{server.diagnostic}
				</SettingsNotice>
			)}

			<SettingsSection
				title="Configuration"
				description={
					server.source === 'local'
						? 'Changes are saved to this package’s mcp.json.'
						: 'Changes are saved in Kucedr settings.'
				}
			>
				<SettingsPanel>
					<McpServerForm initial={{ id: server.id, entry: server.data }} onSubmit={save} />
				</SettingsPanel>
				<div className="flex flex-wrap items-center gap-2 px-0.5 py-1">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void test()}
						disabled={testing || saving || !saved}
					>
						{testing ? (
							<RefreshCw className="size-3.5 animate-spin" />
						) : (
							<FlaskConical className="size-3.5" />
						)}
						{testing ? 'Testing' : 'Test'}
					</Button>
					{server.source === 'configured' && saved && (
						<Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
							<Button
								type="button"
								variant="destructive"
								size="sm"
								disabled={saving}
								onClick={() => setConfirmRemoveOpen(true)}
							>
								Remove MCP server
							</Button>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Delete MCP server</DialogTitle>
									<DialogDescription>
										Remove <span className="font-medium text-foreground">{title}</span>? This cannot
										be undone.
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => setConfirmRemoveOpen(false)}
									>
										Cancel
									</Button>
									<Button
										type="button"
										variant="destructive"
										disabled={saving}
										onClick={() => void remove()}
									>
										Delete
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					)}
				</div>
				{testResult && (
					<SettingsNotice
						variant={testResult.ok ? 'default' : 'destructive'}
						icon={testResult.ok ? undefined : AlertTriangle}
					>
						{testResult.ok
							? `${testResult.toolCount} tool${testResult.toolCount === 1 ? '' : 's'} · ${testResult.durationMs} ms`
							: testResult.error || 'Unable to connect.'}
					</SettingsNotice>
				)}
			</SettingsSection>

			<SettingsSection title="Tools" description="Default permission for each tool on this server.">
				{tools.length === 0 && (
					<SettingsNotice>No tools loaded yet. Run Test to load them.</SettingsNotice>
				)}
				{tools.length > 0 && (
					<SettingsPanel>
						{tools.map((tool) => (
							<div key={tool.name} className="border-b border-border/60 last:border-b-0">
								<SettingsRow
									className="border-b-0"
									title={tool.name}
									description={tool.description}
									actions={
										<ToolPermissionControl
											name={tool.name}
											value={tool.permission ?? 'ask'}
											disabled={saving}
											onChange={(permission) => void setPermission(tool.name, permission)}
										/>
									}
								/>
								{tool.inputSchema && (
									<details className="px-4 pb-3 text-xs">
										<summary className="cursor-pointer text-muted-foreground">Input schema</summary>
										<pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
									</details>
								)}
							</div>
						))}
					</SettingsPanel>
				)}
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default McpDetailsPage;
