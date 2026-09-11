import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { App } from '../../../../../../shared/installed_app_types';

interface DeleteProps {
	readonly app: App;
	readonly disabled: boolean;
	readonly menuItem?: boolean;
	readonly onDeleted: (appId: string) => void;
	readonly onError: (message: string) => void;
}

export default function Delete({
	app,
	disabled,
	menuItem,
	onDeleted,
	onError,
}: DeleteProps): React.JSX.Element {
	const { t } = useTranslation();
	const [deleting, setDeleting] = useState(false);

	const handleDelete = (): void => {
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
	};

	if (menuItem) {
		return (
			<button
				type="button"
				role="menuitem"
				disabled={disabled || deleting}
				onClick={handleDelete}
				className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
			>
				<Trash2 className="size-3.5" />
				{t('settings.apps.deleteAction', { name: app.title })}
			</button>
		);
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className="flex-none text-muted-foreground hover:text-destructive"
			aria-label={t('settings.apps.deleteAction', { name: app.title })}
			title={t('settings.apps.deleteAction', { name: app.title })}
			disabled={disabled || deleting}
			onClick={handleDelete}
		>
			<Trash2 className="size-3" />
		</Button>
	);
}
