import { useState } from 'react';
import { Folder, FolderOpen, MoreHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SPLIT_ITEM_CLASS, SPLIT_ITEM_ACTIVE_CLASS } from '@/components/app/base/page/styles';
import { cn } from '@/lib/utils';

interface WorkspaceRowProps {
	readonly workspace: CodingProject;
	readonly selected: boolean;
	readonly onSelect: () => void;
	readonly onRemove: () => void;
}

export function WorkspaceRow({ workspace, selected, onSelect, onRemove }: WorkspaceRowProps): React.JSX.Element {
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
				<button type="button" className={cn(SPLIT_ITEM_CLASS, selected && SPLIT_ITEM_ACTIVE_CLASS)} aria-pressed={selected} title={workspace.directory} onClick={onSelect}>
					<Folder /><span>{workspace.name}</span>
				</button>
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
