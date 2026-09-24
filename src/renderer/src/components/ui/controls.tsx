import type { ReactNode } from 'react';
import { CircularLoader } from './loader';

export function PromptInputControls({
	leadingAction,
	content,
	isLoading,
}: {
	readonly leadingAction?: ReactNode;
	readonly content?: ReactNode;
	readonly isLoading: boolean;
}): React.JSX.Element {
	return (
		<div
			data-slot="prompt-input-controls"
			className="flex min-h-6 w-full items-center justify-between pt-1"
		>
			<div data-slot="prompt-input-control-buttons" className="flex items-center gap-0.5 px-3">
				{leadingAction}
				{content}
			</div>
			{isLoading ? (
				<div role="status" aria-label="Kucedr is responding" className="mr-3 text-muted-foreground">
					<CircularLoader size="md" />
				</div>
			) : null}
		</div>
	);
}
