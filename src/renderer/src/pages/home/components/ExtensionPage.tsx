import type { ReactElement } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export interface OpenExtension {
	/** Absent for extensions imported on their own. */
	readonly pluginId?: string;
	readonly id: string;
	readonly title: string;
	/** The extension's icon as a data URL. */
	readonly icon?: string;
}

interface ExtensionPageProps {
	readonly extension: OpenExtension;
	readonly onClose: () => void;
}

export function ExtensionPage({ extension, onClose }: ExtensionPageProps): ReactElement {
	const { t } = useTranslation();
	return (
		<section
			aria-label={extension.title}
			className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
		>
			<header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
				<h2 className="truncate text-sm font-medium">{extension.title}</h2>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label={t('common.close')}
				>
					<X className="size-4" />
				</Button>
			</header>
			<iframe
				key={`${extension.pluginId ?? ''}/${extension.id}`}
				title={extension.title}
				src={
					extension.pluginId
						? `kucedr-plugin://${extension.pluginId}/${extension.id}/index.html`
						: `kucedr-extension://${extension.id}/index.html`
				}
				sandbox="allow-scripts"
				className="min-h-0 w-full flex-1 border-0 bg-white"
			/>
		</section>
	);
}
