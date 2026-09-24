import type { ReactNode } from 'react';

export function PromptInputControls({
	leadingAction,
	content,
}: {
	readonly leadingAction?: ReactNode;
	readonly content?: ReactNode;
}): React.JSX.Element {
	return (
		<div data-slot="prompt-input-controls" className="inline-flex min-h-6 items-center gap-0.5 px-2 pt-1">
			{leadingAction}
			{content}
		</div>
	);
}
