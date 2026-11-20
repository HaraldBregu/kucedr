import { useEffect, useState, type ReactElement } from 'react';
import type { BrowserPaneCommand, BrowserPaneTab } from '../../../../../shared/browser';
import { cn } from '@/lib/utils';
import { BrowserScreen } from './Screen';
import { BrowserTabs } from './Tabs';
import { BrowserToolbar } from './Toolbar';

export function BrowserPane({
	tabs,
	acting,
	onClose,
}: {
	readonly tabs: readonly BrowserPaneTab[];
	readonly acting: boolean;
	readonly onClose: () => void;
}): ReactElement {
	const active = tabs.reduce((latest, tab) => (tab.order > latest.order ? tab : latest));
	const [error, setError] = useState<string | null>(null);
	const [suggesting, setSuggesting] = useState(false);
	useEffect(() => setError(null), [active.targetId, active.url]);
	const run = (targetId: string, command: BrowserPaneCommand['command'], url?: string): void => {
		setError(null);
		void window.browserPane
			.command({ targetId, command, url })
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
	};

	return (
		<section aria-label="Browser" className="flex h-full min-w-0 flex-col bg-background">
			<BrowserTabs
				tabs={tabs}
				active={active.targetId}
				onSelect={(targetId) => run(targetId, 'focus')}
				onClose={(targetId) => run(targetId, 'close')}
				onNew={() => run(active.targetId, 'new')}
			/>
			<BrowserToolbar
				key={active.targetId}
				tab={active}
				onCommand={(command, url) => run(active.targetId, command, url)}
				onClose={onClose}
				onSuggestionsOpen={setSuggesting}
			/>
			{error ? (
				<p role="alert" className="shrink-0 truncate px-3 py-1 text-xs text-destructive">
					{error}
				</p>
			) : null}
			<div
				className={cn(
					'flex min-h-0 flex-1 flex-col border-2 border-transparent transition-colors',
					acting && 'border-primary'
				)}
			>
				{acting ? (
					<span role="status" className="sr-only">
						The assistant is using this page
					</span>
				) : null}
				<BrowserScreen targetId={active.targetId} error={active.error} />
			</div>
		</section>
	);
}
