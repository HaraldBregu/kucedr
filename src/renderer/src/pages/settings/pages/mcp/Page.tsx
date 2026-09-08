import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FolderOpen, Plus, PlugZap, RefreshCw, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { McpData, McpRegistry } from '@shared/mcp_types';
import { Button } from '@/components/ui/button';
import { mcps } from '@/lib/providers';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { McpServerForm } from './components/McpServerForm';
import { McpServerRow } from './components/McpServerRow';
import { McpCard } from '../providers/McpCard';

const McpPage = (): React.JSX.Element => {
	const navigate = useNavigate();
	const [registry, setRegistry] = useState<McpRegistry>({ servers: [], diagnostics: [] });
	const [loading, setLoading] = useState(true);
	const [importing, setImporting] = useState(false);
	const [addingServer, setAddingServer] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	const load = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError('');
		try {
			setRegistry(await window.mcp.registry());
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

	const upload = async (): Promise<void> => {
		setImporting(true);
		setError('');
		setSuccess('');
		try {
			const result = await window.mcp.importLocal();
			if (result) {
				const skipped = result.skipped.map((entry) => `${entry.name}: ${entry.reason}`).join(' ');
				const message =
					`Uploaded ${result.imported.length} local MCP server${result.imported.length === 1 ? '' : 's'}.` +
					(result.skipped.length > 0 ? ` Skipped ${result.skipped.length}. ${skipped}` : '');
				if (result.imported.length === 0 && result.skipped.length > 0) setError(message);
				else setSuccess(message);
				await load();
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setImporting(false);
		}
	};

	const openRoot = async (): Promise<void> => {
		setError('');
		try {
			await window.mcp.openRoot();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	};

	const catalog = mcps();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title="MCP servers"
				description="Manage remote services and local MCP server packages."
				action={
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="icon-xs"
							aria-label="Open folder"
							title="Open folder"
							onClick={() => void openRoot()}
						>
							<FolderOpen className="size-3" />
						</Button>
						<Button variant="outline" size="xs" onClick={() => void load()} disabled={loading}>
							<RefreshCw className="size-3" />
							Refresh
						</Button>
						<Button variant="outline" size="xs" onClick={() => void upload()} disabled={importing}>
							<Upload className="size-3" />
							{importing ? 'Uploading' : 'Upload'}
						</Button>
						<Button
							size="xs"
							disabled={addingServer}
							onClick={() => setAddingServer(true)}
						>
							<Plus className="size-3" />
							Add server
						</Button>
					</div>
				}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{success && <SettingsNotice>{success}</SettingsNotice>}
			{registry.diagnostics.map((diagnostic) => (
				<SettingsNotice key={diagnostic.path} variant="destructive" icon={AlertTriangle}>
					{diagnostic.name}: {diagnostic.error}
				</SettingsNotice>
			))}

			{addingServer && (
				<SettingsSection title="Add MCP server">
					<SettingsPanel>
						<div className="p-3">
							<McpServerForm
								onSubmit={async (id, entry) => {
									await save(id, entry);
									setAddingServer(false);
								}}
								onCancel={() => setAddingServer(false)}
							/>
						</div>
					</SettingsPanel>
				</SettingsSection>
			)}

			{catalog.length > 0 && (
				<SettingsSection
					title="Available remote servers"
					description="Remote MCP services from installed provider catalogs."
				>
					<div className="space-y-3">
						{catalog.map((service) => (
							<McpCard key={`${service.provider.id}-${service.id}`} service={service} />
						))}
					</div>
				</SettingsSection>
			)}

			<SettingsPanel>
				{loading ? (
					<SettingsLoadingRows rows={2} />
				) : registry.servers.length === 0 ? (
					<SettingsEmptyState
						icon={PlugZap}
						title="No MCP servers"
						description="Add a server or upload a local package to make its tools available to Kucedr."
					/>
				) : (
					registry.servers.map((server) => (
						<McpServerRow
							key={server.id}
							server={server}
							onOpen={() => navigate(`/settings/agent/mcp/${encodeURIComponent(server.id)}`)}
						/>
					))
				)}
			</SettingsPanel>
		</SettingsPageShell>
	);
};

export default McpPage;
