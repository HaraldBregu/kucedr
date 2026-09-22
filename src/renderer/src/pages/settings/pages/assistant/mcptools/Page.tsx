import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
	AgentToolConfiguration,
	AgentToolProfile,
	AgentToolReference,
} from '../../../../../../../shared/agent_tools';
import { SettingsNotice, SettingsPageHeader, SettingsPageShell } from '../../../components';
import { firstErrorMessage } from '../../../components/model-configuration-state';
import McpTools from '../tools/Mcp';

export default function McpToolsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [profile, setProfile] = useState<AgentToolProfile | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void window.agent.getToolProfile('chat').then(setProfile, (failure) => {
			setError(firstErrorMessage(failure, t('settings.modelServices.loadError')));
		});
	}, [t]);

	const updateTool = (tool: AgentToolReference, settings: AgentToolConfiguration): void => {
		if (!profile || saving) return;
		setSaving(true);
		setError(null);
		void window.agent
			.setToolProfileTool('chat', tool, settings)
			.then(setProfile, (failure) => {
				setError(firstErrorMessage(failure, t('settings.modelServices.saveError')));
			})
			.finally(() => setSaving(false));
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.agentTools.mcp.title')}
				description={t('settings.modelServices.agentTools.mcp.description')}
			/>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<McpTools
				settings={profile?.mcp ?? {}}
				disabled={!profile || saving}
				onChange={updateTool}
			/>
		</SettingsPageShell>
	);
}
