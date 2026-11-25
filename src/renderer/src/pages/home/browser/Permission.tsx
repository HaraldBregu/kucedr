import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Mic, X } from 'lucide-react';
import type { BrowserPermissionRequest } from '../../../../../shared/browser';
import { Button } from '@/components/ui/button';

export function BrowserPermissionBar({
	permission,
	onAnswer,
}: {
	readonly permission: BrowserPermissionRequest;
	readonly onAnswer: (answer: 'allow' | 'block' | 'dismiss') => void;
}): ReactElement {
	const { t } = useTranslation();
	const kind = permission.kinds.length > 1 ? 'both' : permission.kinds[0];
	const Icon = kind === 'microphone' ? Mic : Camera;
	return (
		<div role="region" aria-label={t('browserPermission.label')} className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs">
			<Icon className="size-4 shrink-0 text-muted-foreground" />
			<p className="min-w-0 flex-1 truncate" role="status">
				{t(`browserPermission.${kind}`, { site: permission.site })}
			</p>
			<Button type="button" size="sm" variant="outline" onClick={() => onAnswer('block')}>
				{t('browserPermission.block')}
			</Button>
			<Button type="button" size="sm" onClick={() => onAnswer('allow')}>
				{t('browserPermission.allow')}
			</Button>
			<Button
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label={t('browserPermission.close')}
				title={t('browserPermission.close')}
				onClick={() => onAnswer('dismiss')}
			>
				<X />
			</Button>
		</div>
	);
}
