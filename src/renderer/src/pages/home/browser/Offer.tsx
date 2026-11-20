import type { ReactElement } from 'react';
import { KeyRound, X } from 'lucide-react';
import type { BrowserPaneTab } from '../../../../../shared/browser';
import { Button } from '@/components/ui/button';

export function BrowserOffer({
	offer,
	onAnswer,
}: {
	readonly offer: NonNullable<BrowserPaneTab['offer']>;
	readonly onAnswer: (answer: 'save' | 'never' | 'dismiss') => void;
}): ReactElement {
	return (
		<div role="region" aria-label="Save password" className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs">
			<KeyRound className="size-4 shrink-0 text-muted-foreground" />
			<p className="min-w-0 flex-1 truncate">
				{offer.update ? 'Update the saved password for ' : 'Save the password for '}
				<span className="font-medium">{offer.username || 'this login'}</span> on {offer.site}?
			</p>
			<Button type="button" size="sm" onClick={() => onAnswer('save')}>
				{offer.update ? 'Update' : 'Save'}
			</Button>
			{offer.update ? null : (
				<Button type="button" size="sm" variant="ghost" onClick={() => onAnswer('never')}>
					Never for this site
				</Button>
			)}
			<Button type="button" size="icon-sm" variant="ghost" aria-label="Not now" title="Not now" onClick={() => onAnswer('dismiss')}>
				<X />
			</Button>
		</div>
	);
}
