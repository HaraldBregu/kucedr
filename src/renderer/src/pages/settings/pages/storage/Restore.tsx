import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface RestoreProps {
	readonly open: boolean;
	readonly disabled: boolean;
	readonly hasFolders: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onRestore: () => void;
}

export default function Restore({
	open,
	disabled,
	hasFolders,
	onOpenChange,
	onRestore,
}: RestoreProps): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('settings.storage.restoreDialog.title')}</DialogTitle>
					<DialogDescription>{t('settings.storage.restoreDialog.description')}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t('settings.storage.cancel')}
					</Button>
					<Button disabled={disabled || !hasFolders} onClick={() => onRestore()}>
						<Download className="size-3" />
						{t('settings.storage.restoreDialog.confirm')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
