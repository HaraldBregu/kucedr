import { useRef, useState } from 'react';
import { Check, ChevronDown, File, FolderOpen, ListChecks, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface WorkspaceSelectorProps {
	readonly workspace: CodingProject;
	readonly workspaces: readonly CodingProject[];
	readonly onSelect: (id: string) => void;
	readonly onRemove: () => void;
	readonly onCreate: (creation: 'markdown' | 'instructions') => void;
}

export function WorkspaceSelector({ workspace, workspaces, onSelect, onRemove, onCreate }: WorkspaceSelectorProps): React.JSX.Element {
	const { t } = useTranslation();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const pendingCreation = useRef<'markdown' | 'instructions' | null>(null);
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
		<div className="min-w-0 flex-1">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="w-full min-w-0 justify-start px-2" disabled={busy} aria-label={t('code.workspaces', 'Workspaces')}>
						<span className="min-w-0 flex-1 truncate text-left">{workspace.name}</span><ChevronDown />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="max-h-80 min-w-56 overflow-y-auto" onCloseAutoFocus={(event) => {
					if (pendingCreation.current) {
						event.preventDefault();
						onCreate(pendingCreation.current);
						pendingCreation.current = null;
					}
				}}>
					{workspaces.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onSelect(item.id)}><span className="min-w-0 flex-1 truncate">{item.name}</span>{item.id === workspace.id && <Check />}</DropdownMenuItem>)}
					<DropdownMenuSeparator />
					<DropdownMenuItem disabled={!workspace.available} onSelect={() => { pendingCreation.current = 'markdown'; }}><File />{t('codeFiles.newMarkdown', 'Markdown')}</DropdownMenuItem>
					<DropdownMenuItem disabled={!workspace.available} onSelect={() => { pendingCreation.current = 'instructions'; }}><ListChecks />{t('codeFiles.instructions', 'Instructions')}</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem disabled={!workspace.available} onSelect={() => void action(false)}><FolderOpen />{t('code.openFolder', 'Open folder')}</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => void action(true)}><X />{t('code.removeWorkspace', 'Remove from list')}</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{!workspace.available && <p className="px-2.5 text-xs text-muted-foreground">{t('code.unavailable', 'Folder unavailable')}</p>}
			{error && <p role="alert" className="px-2.5 text-xs text-destructive">{error}</p>}
		</div>
	);
}
