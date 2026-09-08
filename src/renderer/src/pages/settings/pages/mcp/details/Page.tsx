import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FlaskConical, Plug, RefreshCw } from 'lucide-react';
import type { McpData, McpServerInfo, McpTestResult } from '@shared/mcp_types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../../components';
import { McpServerForm } from '../components/McpServerForm';

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

	const load = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError('');
		try {
			const registry = await window.mcp.registry();
			setServer(registry.servers.find((entry) => entry.id === id) ?? null);
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
			}
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
		setTestResult(undefined);
		try {
			setTestResult(await window.mcp.test(server.id));
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

	const remove = async (): Promise<void> => {
		if (!server || server.source !== 'configured') return;
		setSaving(true);
		setError('');
		try {
			await window.mcp.delete(server.id);
			navigate('/settings/agent/mcp');
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
				<SettingsPageHeader
					title="MCP server"
					action={
						<Button variant="outline" size="xs" onClick={() => navigate('/settings/agent/mcp')}>
							<ArrowLeft className="size-3" />
							All servers
						</Button>
					}
				/>
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
			<SettingsPageHeader
				title={title}
				description={description}
				action={
					<div className="flex flex-wrap items-center gap-1.5">
						<Button variant="ghost" size="xs" onClick={() => navigate('/settings/agent/mcp')}>
							<ArrowLeft className="size-3" />
							All servers
						</Button>
						<Button
							variant="outline"
							size="xs"
							onClick={() => void test()}
							disabled={testing || saving}
						>
							{testing ? (
								<RefreshCw className="size-3 animate-spin" />
							) : (
								<FlaskConical className="size-3" />
							)}
							{testing ? 'Testing' : server.data.type === 'stdio' ? 'Trust and test' : 'Test'}
						</Button>
						<label className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Switch
								checked={server.data.enabled !== false}
								disabled={saving || testing}
								onCheckedChange={(enabled) =>
									void save(server.id, { ...server.data, enabled }).catch(() => undefined)
								}
								aria-label={`${server.data.enabled === false ? 'Enable' : 'Disable'} ${title}`}
							/>
							{server.data.enabled === false ? 'Disabled' : 'Enabled'}
						</label>
					</div>
				}
			/>

			{server.data.type === 'stdio' && (
				<SettingsNotice>
					Save, enable or test only local server commands you trust. They run with your desktop
					account's privileges. Changed launch settings require renewed trust.
				</SettingsNotice>
			)}
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{success && <SettingsNotice>{success}</SettingsNotice>}
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
					<div className="p-4">
						<McpServerForm
							initial={{ id: server.id, entry: server.data }}
							onSubmit={save}
							onCancel={() => navigate('/settings/agent/mcp')}
							onRemove={server.source === 'configured' ? remove : undefined}
						/>
					</div>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default McpDetailsPage;
