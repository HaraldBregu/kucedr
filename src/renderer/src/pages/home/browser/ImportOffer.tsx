import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { BrowserSource } from '../../../../../shared/browser_import';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export function BrowserImportOffer({
	sources,
	onDismiss,
}: {
	readonly sources: readonly BrowserSource[];
	readonly onDismiss: () => void;
}): ReactElement {
	const { t } = useTranslation();
	return (
		<Dialog open onOpenChange={(open) => !open && onDismiss()}>
			<DialogContent className="sm:max-w-lg">
				<DialogTitle>{t('settings.browser.importOfferTitle')}</DialogTitle>
				<DialogDescription>{t('settings.browser.importOfferDescription')}</DialogDescription>
				<ul className="max-h-56 space-y-2 overflow-y-auto">
					{sources.map((source) => (
						<li key={source.id} className="rounded-md border px-3 py-2">
							<p className="text-sm font-medium">{[source.app, source.profile].filter(Boolean).join(' — ')}</p>
							<p className="text-xs text-muted-foreground">
								{source.kinds.map((kind) => t(`settings.browser.${kind}`)).join(', ')}
							</p>
						</li>
					))}
				</ul>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="outline" onClick={onDismiss}>
						{t('settings.browser.importOfferLater')}
					</Button>
					<Button
						type="button"
						onClick={() => {
							onDismiss();
							window.location.hash = '#/settings/browser';
						}}
					>
						{t('settings.browser.importOfferAction')}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
