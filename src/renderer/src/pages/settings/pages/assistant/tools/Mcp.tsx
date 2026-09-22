import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Network } from 'lucide-react';
import type { McpRegistry, McpTestResult } from '@shared/mcp_types';
import type { AgentToolConfiguration, AgentToolReference } from '../../../../../../../shared/agent_tools';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../../components';
import { firstErrorMessage } from '../../../components/model-configuration-state';

type McpProps = {
	search: string;
	settings: Record<string, Record<string, AgentToolConfiguration>>;
	disabled: boolean;
	onChange: (tool: AgentToolReference, settings: AgentToolConfiguration) => void;
};

export default function Mcp({ search, settings, disabled, onChange }: McpProps): React.JSX.Element {
	const { t } = useTranslation();
	const [registry, setRegistry] = useState<McpRegistry | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState<string | null>(null);
	const [results, setResults] = useState<Record<string, McpTestResult>>({});
	const prefix = 'settings.modelServices.agentTools.mcp';
	const query = search.trim().toLocaleLowerCase();

	useEffect(() => {
		let mounted = true;
		void window.mcp.registry().then((next) => {
			if (mounted) setRegistry(next);
		}, (failure) => {
			if (mounted) setError(firstErrorMessage(failure, t(`${prefix}.loadError`)));
		});
		return () => { mounted = false; };
	}, [t]);

	const servers = registry?.servers.filter((server) =>
		[t(`${prefix}.title`), server.id, server.data.name, ...(results[server.id]?.tools ?? [])]
			.join(' ').toLocaleLowerCase().includes(query)
	) ?? [];

	return (
		<SettingsSection title={t(`${prefix}.title`)} description={t(`${prefix}.description`)}>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			{!registry && !error && <SettingsNotice>{t(`${prefix}.loading`)}</SettingsNotice>}
			{registry && servers.length === 0 && <SettingsNotice>{t(`${prefix}.${query ? 'noMatches' : 'empty'}`)}</SettingsNotice>}
			{servers.length > 0 && <SettingsPanel>
				{servers.map((server) => {
					const result = results[server.id];
					const serverMatches = [t(`${prefix}.title`), server.id, server.data.name].join(' ').toLocaleLowerCase().includes(query);
					return <div key={server.id}>
						<SettingsRow
							title={server.data.name || server.id}
							description={`${server.id} · ${t(`${prefix}.${server.data.enabled === false ? 'disabled' : 'onDemand'}`)}`}
							icon={Network}
							actions={<Button
								variant="outline"
								size="sm"
								disabled={server.data.enabled === false || loading !== null}
								aria-label={`${t(`${prefix}.show`)}: ${server.data.name || server.id}`}
								onClick={() => {
									setLoading(server.id);
									void window.mcp.test(server.id).then((next) => {
										setResults((current) => ({ ...current, [server.id]: next }));
									}, (failure) => {
										setResults((current) => ({ ...current, [server.id]: {
											ok: false, tools: [], toolCount: 0, durationMs: 0,
											error: firstErrorMessage(failure, t(`${prefix}.inspectError`)),
										} }));
									}).finally(() => setLoading(null));
								}}
							>{t(`${prefix}.${loading === server.id ? 'loading' : 'show'}`)}</Button>}
						/>
						{result && !result.ok && <SettingsNotice variant="destructive">{result.error || t(`${prefix}.inspectError`)}</SettingsNotice>}
						{result?.ok && result.tools.length === 0 && <SettingsNotice>{t(`${prefix}.noTools`)}</SettingsNotice>}
						{result?.ok && result.tools.filter((name) => serverMatches || name.toLocaleLowerCase().includes(query)).map((name) => {
							const settingsForTool = settings[server.id]?.[name] ?? { enabled: true, permission: 'allow' as const };
							const tool: AgentToolReference = { kind: 'mcp', serverId: server.id, toolName: name };
							return <SettingsRow
								key={name}
								title={name}
								description={server.data.name || server.id}
								actions={<>
									<Select
										value={settingsForTool.permission}
										onValueChange={(permission) => onChange(tool, {
											...settingsForTool,
											permission: permission as AgentToolConfiguration['permission'],
										})}
										disabled={disabled}
									>
										<SelectTrigger size="sm" className="w-24 text-xs [&_svg]:size-3" aria-label={`${name} permission`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ask">{t('settings.modelServices.agentTools.permissions.ask')}</SelectItem>
											<SelectItem value="allow">{t('settings.modelServices.agentTools.permissions.allow')}</SelectItem>
											<SelectItem value="deny">{t('settings.modelServices.agentTools.permissions.deny')}</SelectItem>
										</SelectContent>
									</Select>
									<Switch
										checked={settingsForTool.enabled}
										onCheckedChange={(enabled) => onChange(tool, { ...settingsForTool, enabled })}
										disabled={disabled}
										aria-label={`${name} enabled`}
									/>
								</>}
							/>;
						})}
					</div>;
				})}
			</SettingsPanel>}
		</SettingsSection>
	);
}
