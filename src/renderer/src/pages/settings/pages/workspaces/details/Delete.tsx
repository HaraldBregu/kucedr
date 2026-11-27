import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { WorkspaceContents } from '@shared/workspaces_types';

interface DeleteProps {
	readonly name: string;
	readonly contents: WorkspaceContents;
	readonly onClose: () => void;
	readonly onConfirm: (deleteChats: boolean) => void;
}

export function Delete({ name, contents, onClose, onConfirm }: DeleteProps): ReactElement {
	const { t } = useTranslation();
	const [typed, setTyped] = useState('');
	const [deleteChats, setDeleteChats] = useState(false);
	const matches = typed.trim() === name;
	const { chats, tasks, browser } = contents;
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
					<DialogDescription>{t('settings.workspaces.deleteIntro')}</DialogDescription>
				</DialogHeader>
				<div className="grid max-h-80 gap-3 overflow-y-auto text-sm">
					<section className="grid gap-1">
						<h3 className="font-medium">
							{t('settings.workspaces.deleteChats', { count: chats.length })}
						</h3>
						{chats.length > 0 && (
							<>
								<ul className="grid gap-0.5 rounded-md border border-border/60 p-2 text-xs text-muted-foreground">
									{chats.map((chat) => (
										<li key={chat.id} className="truncate">
											{chat.title.trim() || t('settings.chatHistory.untitled')}
											{chat.archived && ` · ${t('settings.workspaces.archived')}`}
										</li>
									))}
								</ul>
								<label className="flex items-start gap-2 text-xs">
									<Checkbox
										checked={deleteChats}
										onCheckedChange={(checked) => setDeleteChats(checked === true)}
										className="mt-0.5"
									/>
									<span>{t('settings.workspaces.deleteChatsToo', { count: chats.length })}</span>
								</label>
								<p className="text-xs text-muted-foreground">
									{deleteChats
										? t('settings.workspaces.chatsDeleted')
										: t('settings.workspaces.chatsMoved')}
								</p>
							</>
						)}
					</section>
					<section className="grid gap-1">
						<h3 className="font-medium">{t('settings.workspaces.deleteRemoved')}</h3>
						<ul className="grid list-disc gap-0.5 pl-5 text-xs text-muted-foreground">
							{tasks.length > 0 && (
								<li>{t('settings.workspaces.deleteTasks', { count: tasks.length, names: tasks.join(', ') })}</li>
							)}
							{browser && <li>{t('settings.workspaces.deleteBrowser')}</li>}
							<li>{t('settings.workspaces.deleteSettings')}</li>
						</ul>
					</section>
					<section className="grid gap-1">
						<h3 className="font-medium">{t('settings.workspaces.deleteKept')}</h3>
						<p className="text-xs text-muted-foreground">{t('settings.workspaces.deleteKeptDescription')}</p>
					</section>
				</div>
				<form
					id="workspace-delete"
					className="grid gap-1.5"
					onSubmit={(event) => {
						event.preventDefault();
						if (matches) onConfirm(deleteChats);
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
