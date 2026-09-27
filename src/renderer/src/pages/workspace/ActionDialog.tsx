import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export interface WorkspaceAction {
	readonly kind: 'create-file' | 'create-folder' | 'rename' | 'delete';
	readonly entry?: WorkspaceTreeEntry;
	readonly parentPath: string;
}

interface WorkspaceActionDialogProps {
	readonly action: WorkspaceAction;
	readonly busy: boolean;
	readonly error: string;
	readonly onClose: () => void;
	readonly onConfirm: (name: string) => void;
}

export function WorkspaceActionDialog({ action, busy, error, onClose, onConfirm }: WorkspaceActionDialogProps): React.JSX.Element {
	const { t } = useTranslation();
	const [name, setName] = useState(action.kind === 'rename' ? action.entry?.name ?? '' : '');
	const deleting = action.kind === 'delete';
	const title = action.kind === 'create-file' ? t('workspaceSidebar.newFile', 'New file')
		: action.kind === 'create-folder' ? t('workspaceSidebar.newFolder', 'New folder')
		: action.kind === 'rename' ? t('workspaceSidebar.renameEntry', { name: action.entry?.name })
		: t('workspaceSidebar.deleteEntry', { name: action.entry?.name });

	return (
		<Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
			<DialogContent showCloseButton={false}>
				<form onSubmit={(event) => { event.preventDefault(); onConfirm(name.trim()); }} className="grid gap-4">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{deleting
							? t('workspaceSidebar.deleteWarning', 'This permanently deletes the item and its contents.')
							: t('workspaceSidebar.namePrompt', 'Enter a name for the item.')}</DialogDescription>
					</DialogHeader>
					{!deleting ? <Input autoFocus aria-label={t('workspaceSidebar.name', 'Name')} value={name} onChange={(event) => setName(event.target.value)} /> : null}
					{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" disabled={busy}>{t('common.cancel', 'Cancel')}</Button>} />
						<Button type="submit" variant={deleting ? 'destructive' : 'default'} disabled={busy || (!deleting && !name.trim())}>
							{deleting ? t('common.delete', 'Delete') : action.kind === 'rename' ? t('common.rename', 'Rename') : t('workspaceSidebar.create', 'Create')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
