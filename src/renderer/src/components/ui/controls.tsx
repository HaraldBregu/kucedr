import type { ReactNode } from 'react';
import { CircularLoader } from './loader';

export function PromptInputControls({
	leadingAction,
	content,
	trailingAction,
	isLoading,
	fillActions = false,
}: {
	readonly leadingAction?: ReactNode;
	readonly content?: ReactNode;
	readonly trailingAction?: ReactNode;
	readonly isLoading: boolean;
	readonly fillActions?: boolean;
}): React.JSX.Element {
	return (
		<div
			data-slot="prompt-input-controls"
			className="mt-auto flex min-h-10 w-full items-center justify-between gap-2"
		>
			<div data-slot="prompt-input-control-buttons" className="flex shrink-0 items-center">
				{leadingAction}
			</div>
			<div
				data-slot="prompt-input-control-actions"
				className={cn(
					'flex min-w-0 items-center justify-end gap-1.5',
					fillActions && 'flex-1'
				)}
			>
				{content}
				{isLoading ? (
					<div role="status" aria-label="Kucedr is responding" className="text-muted-foreground">
						<CircularLoader size="sm" />
					</div>
				) : null}
				{trailingAction}
			</div>
		</div>
	);
}
