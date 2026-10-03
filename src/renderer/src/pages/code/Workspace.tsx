import { useState } from 'react';
import { FolderOpen, MoreHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WorkspaceSelectorProps {
	readonly workspace: CodingProject;
	readonly workspaces: readonly CodingProject[];
	readonly onSelect: (id: string) => void;
	readonly onRemove: () => void;
}

export function WorkspaceSelector({ workspace, workspaces, onSelect, onRemove }: WorkspaceSelectorProps): React.JSX.Element {
	const { t } = useTranslation();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const action = async (remove: boolean): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			if (remove) { await window.coder.removeProject(workspace.id); onRemove(); }
			else await window.coder.openProject(workspace.id);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('code.actionError', 'Unable to update workspace.'));
		} finally { setBusy(false); }
	};
	return (
		<div>
			<div className="flex min-w-0 items-center gap-1">
				<Select value={workspace.id} onValueChange={(id) => { if (id) onSelect(id); }}>
					<SelectTrigger className="min-w-0 flex-1" aria-label={t('code.workspaces', 'Workspaces')}><SelectValue>{workspace.name}</SelectValue></SelectTrigger>
					<SelectContent>{workspaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
				</Select>
				<DropdownMenu>
					<DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" disabled={busy} aria-label={t('code.workspaceOptions', 'Options for {{name}}', { name: workspace.name })}><MoreHorizontal /></Button></DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem disabled={!workspace.available} onSelect={() => void action(false)}><FolderOpen />{t('code.openFolder', 'Open folder')}</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => void action(true)}><X />{t('code.removeWorkspace', 'Remove from list')}</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{!workspace.available && <p className="px-2.5 text-xs text-muted-foreground">{t('code.unavailable', 'Folder unavailable')}</p>}
			{error && <p role="alert" className="px-2.5 text-xs text-destructive">{error}</p>}
		</div>
	);
}
