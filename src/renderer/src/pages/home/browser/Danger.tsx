import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function BrowserDanger({
	url,
	busy,
	onContinue,
}: {
	readonly url: string;
	readonly busy: boolean;
	readonly onContinue: () => void;
}): ReactElement {
	const { t } = useTranslation();
	return (
		<Empty role="alert">
			<EmptyHeader>
				<EmptyMedia>
					<ShieldAlert className="size-12 text-destructive" />
				</EmptyMedia>
				<EmptyTitle>{t('browserDanger.title')}</EmptyTitle>
				<EmptyDescription>
					{t('browserDanger.body', { site: URL.canParse(url) ? new URL(url).host : url })}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button type="button" variant="destructive" disabled={busy} onClick={onContinue}>
					{t('browserDanger.continue')}
				</Button>
				{busy ? <p className="text-xs text-muted-foreground">{t('browserDanger.busy')}</p> : null}
			</EmptyContent>
		</Empty>
	);
}
