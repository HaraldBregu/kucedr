import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type {
	AgentToolConfiguration,
	AgentToolProfile,
	AgentToolReference,
} from '../../../../../../../shared/agent_tools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
} from '../../../components';
import { firstErrorMessage } from '../../../components/model-configuration-state';
import McpTools from '../tools/Mcp';

export default function McpToolsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');
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
			<div className="relative">
				<Input
					type="text"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={t('settings.modelServices.agentTools.searchPlaceholder')}
					aria-label={t('settings.modelServices.agentTools.searchPlaceholder')}
					className="pr-10"
				/>
				{search && (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute right-1.5 top-1.5 text-muted-foreground"
						onClick={() => setSearch('')}
						aria-label={t('settings.modelServices.agentTools.clearSearch')}
					>
						<X aria-hidden="true" />
					</Button>
				)}
			</div>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<McpTools
				search={search.trim().toLocaleLowerCase()}
				settings={profile?.mcp ?? {}}
				disabled={!profile || saving}
				onChange={updateTool}
			/>
		</SettingsPageShell>
	);
}
