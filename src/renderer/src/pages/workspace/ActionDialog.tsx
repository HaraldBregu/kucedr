import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export interface WorkspaceAction {
	readonly kind: 'create-file' | 'create-folder';
	readonly parentPath: string;
}

interface WorkspaceActionDialogProps {
	readonly action: WorkspaceAction;
	readonly busy: boolean;
	readonly error: string;
	readonly onClose: () => void;
	readonly onConfirm: (name: string) => void;
}

export function WorkspaceActionDialog({
	action,
	busy,
	error,
	onClose,
	onConfirm,
}: WorkspaceActionDialogProps): React.JSX.Element {
	const { t } = useTranslation();
	const [name, setName] = useState('');
	const title =
		action.kind === 'create-file'
			? t('workspaceSidebar.newFile', 'New file')
			: t('workspaceSidebar.newFolder', 'New folder');

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !busy) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onConfirm(name.trim());
					}}
					className="grid gap-4"
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>
							{t('workspaceSidebar.namePrompt', 'Enter a name for the item.')}
						</DialogDescription>
					</DialogHeader>
					<Input
						autoFocus
						aria-label={t('workspaceSidebar.name', 'Name')}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					<DialogFooter>
						<DialogClose
							render={
								<Button type="button" variant="outline" disabled={busy}>
									{t('common.cancel', 'Cancel')}
								</Button>
							}
						/>
						<Button type="submit" disabled={busy || !name.trim()}>
							{t('workspaceSidebar.create', 'Create')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
