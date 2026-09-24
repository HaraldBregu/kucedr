import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, PlugZap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { McpData, McpRegistry } from '@shared/mcp_types';
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
import { McpServerForm } from './components/McpServerForm';
import { McpServerRow } from './components/McpServerRow';

const McpPage = (): React.JSX.Element => {
	const navigate = useNavigate();
	const [registry, setRegistry] = useState<McpRegistry>({ servers: [], diagnostics: [] });
	const [loading, setLoading] = useState(true);
	const [addingServer, setAddingServer] = useState(false);
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState('');

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
			) : registry.servers.length === 0 ? (
				<SettingsEmptyState
					icon={PlugZap}
					title="No MCP servers"
					description="Add a server or upload a local package to make its tools available to Kucedr."
				/>
			) : (
				<div className="-mx-4 grid grid-cols-1 gap-y-3 pb-4">
					{registry.servers.map((server) => (
						<McpServerRow
							key={server.id}
							server={server}
							onOpen={() => navigate(`/settings/mcp/${encodeURIComponent(server.id)}`)}
							onEnabledChange={async (enabled) => {
								setSavingId(server.id);
								try {
									await save(server.id, { ...server.data, enabled });
								} catch {
								} finally {
									setSavingId(null);
								}
							}}
							saving={savingId === server.id}
						/>
					))}
				</div>
			)}
		</SettingsPageShell>
	);
};

export default McpPage;
