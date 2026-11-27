import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ChevronRight, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpaces } from '@/spaces/context';
import { Space } from '../../../home/Space';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../components';

const WorkspacesPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { current, workspaces } = useSpaces();
	const [error, setError] = useState('');

	const create = (): void => {
		setError('');
		void window.workspaces.create().then(
			(workspace) => {
				if (workspace) void navigate(`/settings/workspaces/${workspace.id}`);
			},
			(reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))
		);
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.workspaces.title')}
				description={t('settings.workspaces.description')}
				action={
					<Button type="button" variant="outline" size="sm" onClick={create}>
						<FolderPlus />
						{t('spaces.create')}
					</Button>
				}
			/>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			<SettingsPanel>
				{workspaces.map((workspace) => (
					<SettingsRow
						key={workspace.id}
						title={
							<span className="flex min-w-0 items-center gap-2">
								<Space workspace={workspace} title={workspace.name} />
							</span>
						}
						description={<span className="break-all">{workspace.folder}</span>}
						onClick={() => void navigate(`/settings/workspaces/${workspace.id}`)}
					>
						{workspace.id === current && (
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<Check className="size-3" aria-hidden="true" />
								{t('settings.workspaces.current')}
							</span>
						)}
						<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					</SettingsRow>
				))}
			</SettingsPanel>
		</SettingsPageShell>
	);
};

export default WorkspacesPage;
