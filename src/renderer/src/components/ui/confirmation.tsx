import { useCallback, useRef, useState } from 'react';
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

interface ConfirmationOptions {
	title: string;
	description: string;
	confirmLabel?: string;
}

export function useConfirmation(): {
	confirm: (options: ConfirmationOptions) => Promise<boolean>;
	dialog: React.JSX.Element;
} {
	const { t } = useTranslation();
	const [options, setOptions] = useState<ConfirmationOptions | null>(null);
	const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
	const confirm = useCallback((next: ConfirmationOptions): Promise<boolean> => new Promise((resolve) => {
		resolveRef.current = resolve;
		setOptions(next);
	}), []);
	const close = (confirmed: boolean): void => {
		resolveRef.current?.(confirmed);
		resolveRef.current = null;
		setOptions(null);
	};
	return {
		confirm,
		dialog: (
			<Dialog open={options !== null} onOpenChange={(open) => { if (!open) close(false); }}>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>{options?.title}</DialogTitle>
						<DialogDescription>{options?.description}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" autoFocus onClick={() => close(false)}>{t('common.cancel', 'Cancel')}</Button>
						<Button variant="destructive" onClick={() => close(true)}>{options?.confirmLabel ?? t('common.delete', 'Delete')}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		),
	};
}
