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
import type { WorkspaceInfo } from '@shared/workspaces_types';

interface SpaceEditProps {
	readonly workspace: WorkspaceInfo;
	readonly onClose: () => void;
}

export function SpaceEdit({ workspace, onClose }: SpaceEditProps): ReactElement {
	const { t } = useTranslation();
	const [name, setName] = useState(workspace.name);
	const [error, setError] = useState('');
	const attempt = (action: Promise<unknown>, close = false): void => {
		setError('');
		void action.then(
			() => {
				if (close) onClose();
			},
			(reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))
		);
	};
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>{t('spaces.editTitle')}</DialogTitle>
					<DialogDescription className="break-all">
						{workspace.missing ? t('spaces.missing') : workspace.folder}
					</DialogDescription>
				</DialogHeader>
				<form
					id="space-edit"
					onSubmit={(event) => {
						event.preventDefault();
						attempt(window.workspaces.rename(workspace.id, name), true);
					}}
				>
					<Input
						value={name}
						maxLength={64}
						aria-label={t('spaces.name')}
						onChange={(event) => setName(event.target.value)}
					/>
				</form>
				<div className="flex flex-wrap gap-2">
					{workspace.missing && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => attempt(window.workspaces.locate(workspace.id))}
						>
							{t('spaces.locate')}
						</Button>
					)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => attempt(window.workspaces.pickImage(workspace.id))}
					>
						{t('spaces.picture')}
					</Button>
					{workspace.image && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => attempt(window.workspaces.removeImage(workspace.id))}
						>
							{t('spaces.removePicture')}
						</Button>
					)}
				</div>
				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
				<DialogFooter>
					<DialogClose render={<Button variant="outline">{t('common.cancel')}</Button>} />
					<Button type="submit" form="space-edit" disabled={!name.trim()}>
						{t('common.save')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
