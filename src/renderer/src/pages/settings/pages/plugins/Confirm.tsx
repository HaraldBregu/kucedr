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

export default function Confirm({
	name,
	open,
	disabled = false,
	onCancel,
	onConfirm,
}: {
	readonly name: string;
	readonly open: boolean;
	readonly disabled?: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('settings.integrations.confirmRemoveTitle')}</DialogTitle>
					<DialogDescription>
						{t('settings.integrations.confirmRemoveDescription', { name })}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>
						{t('settings.integrations.cancel')}
					</Button>
					<Button type="button" variant="destructive" disabled={disabled} onClick={onConfirm}>
						{t('settings.integrations.confirmRemove')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
