import { useEffect, useRef, type ReactElement } from 'react';
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
	const frameRef = useRef<HTMLIFrameElement>(null);
	const { pluginId, id } = extension;

	useEffect(() => {
		const onMessage = (event: MessageEvent): void => {
			const frame = frameRef.current?.contentWindow;
			const { kucedrStore, op, key, value } = event.data ?? {};
			if (!frame || event.source !== frame || typeof kucedrStore !== 'number') return;
			const result =
				op === 'get'
					? window.plugins.getExtensionStoreValue(pluginId, id, key)
					: op === 'set'
						? window.plugins.setExtensionStoreValue(pluginId, id, key, value)
						: op === 'delete'
							? window.plugins.deleteExtensionStoreValue(pluginId, id, key)
							: Promise.reject(new Error('Unknown store operation.'));
			result.then(
				(value) => frame.postMessage({ kucedrStore, value }, '*'),
				(error: unknown) => frame.postMessage({ kucedrStore, error: String(error) }, '*')
			);
		};
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, [pluginId, id]);

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
				ref={frameRef}
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
