import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { App } from '../../../../../../shared/installed_app_types';

interface DeleteProps {
	readonly app: App;
	readonly disabled: boolean;
	readonly onDeleted: (appId: string) => void;
	readonly onError: (message: string) => void;
}

export default function Delete({
	app,
	disabled,
	onDeleted,
	onError,
}: DeleteProps): React.JSX.Element {
	const { t } = useTranslation();
	const [deleting, setDeleting] = useState(false);

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className="flex-none text-muted-foreground hover:text-destructive"
			aria-label={t('settings.apps.deleteAction', { name: app.title })}
			title={t('settings.apps.deleteAction', { name: app.title })}
			disabled={disabled || deleting}
			onClick={() => {
				setDeleting(true);
				onError('');
				void window.apps
					.delete(app.id)
					.then((deleted) => {
						if (deleted) onDeleted(app.id);
					})
					.catch((error: unknown) => {
						onError(
							error instanceof Error && error.message.trim().length > 0
								? error.message
								: t('settings.apps.deleteError')
						);
					})
					.finally(() => setDeleting(false));
			}}
		>
			<Trash2 className="size-3" />
		</Button>
	);
}
