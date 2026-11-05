import type { ReactElement } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RecorderError({
	message,
	actionLabel,
	onAction,
}: {
	readonly message: string | null;
	readonly actionLabel?: string;
	readonly onAction?: () => void;
}): ReactElement | null {
	if (!message) return null;

	return (
		<div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive shadow-sm">
			<AlertCircle className="size-4 shrink-0" />
			<p className="min-w-0 flex-1 truncate text-xs font-medium">{message}</p>
			{actionLabel && onAction ? (
				<Button
					type="button"
					variant="outline"
					size="xs"
					className="shrink-0 border-destructive/30 bg-background/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={onAction}
				>
					{actionLabel}
				</Button>
			) : null}
		</div>
	);
}
