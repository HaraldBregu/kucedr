import { useState, type ReactElement } from 'react';
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

interface DeleteProps {
	readonly name: string;
	readonly chats: number;
	readonly onClose: () => void;
	readonly onConfirm: () => void;
}

export function Delete({ name, chats, onClose, onConfirm }: DeleteProps): ReactElement {
	const { t } = useTranslation();
	const [typed, setTyped] = useState('');
	const matches = typed.trim() === name;
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>{t('settings.workspaces.deleteTitle', { name })}</DialogTitle>
					<DialogDescription>{t('settings.workspaces.deleteDescription', { count: chats })}</DialogDescription>
				</DialogHeader>
				<form
					id="workspace-delete"
					className="grid gap-1.5"
					onSubmit={(event) => {
						event.preventDefault();
						if (matches) onConfirm();
					}}
				>
					<label htmlFor="workspace-delete-name" className="text-xs text-muted-foreground">
						{t('settings.workspaces.deleteType', { name })}
					</label>
					<Input
						id="workspace-delete-name"
						autoFocus
						autoComplete="off"
						value={typed}
						onChange={(event) => setTyped(event.target.value)}
					/>
				</form>
				<DialogFooter>
					<DialogClose render={<Button variant="outline">{t('common.cancel')}</Button>} />
					<Button type="submit" form="workspace-delete" variant="destructive" disabled={!matches}>
						{t('settings.workspaces.delete')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
