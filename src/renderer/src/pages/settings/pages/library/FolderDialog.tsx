import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function LibraryFolderDialog({
	open,
	onOpenChange,
	onCreate,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onCreate: (name: string) => Promise<void>;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [name, setName] = useState('');
	const [creating, setCreating] = useState(false);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('settings.library.createFolder')}</DialogTitle>
					<DialogDescription>{t('settings.library.folderDescription')}</DialogDescription>
				</DialogHeader>
				<form onSubmit={async (event) => {
					event.preventDefault();
					if (!name.trim() || /[\\/:\0]/.test(name) || name.trim() === '.' || name.trim() === '..') return;
					setCreating(true);
					try {
						await onCreate(name.trim());
						setName('');
						onOpenChange(false);
					} finally {
						setCreating(false);
					}
				}} className="space-y-4">
					<Input autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-label={t('settings.library.folderName')} placeholder={t('settings.library.folderName')} />
					<DialogFooter className="border-0 bg-transparent p-0">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
						<Button type="submit" disabled={!name.trim() || /[\\/:\0]/.test(name) || creating}>{t('settings.library.createFolder')}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
