import { useEffect, useState, type ReactElement } from 'react';
import type { BrowserPaneCommand, BrowserPaneTab, BrowserRoute } from '../../../../../shared/browser';
import { cn } from '@/lib/utils';
import { BrowserDownloadBar } from './Download';
import { BrowserOffer } from './Offer';
import { BrowserScreen } from './Screen';
import { BrowserTabs } from './Tabs';
import { BrowserToolbar } from './Toolbar';

const IS_MAC = navigator.platform.startsWith('Mac');

export function BrowserPane({
	tabs,
	acting,
	chat,
	onStop,
	onClose,
}: {
	readonly tabs: readonly BrowserPaneTab[];
	readonly acting: readonly string[];
	readonly chat?: string;
	readonly onStop: () => void;
	readonly onClose: () => void;
}): ReactElement {
	const active = tabs.reduce((latest, tab) => (tab.order > latest.order ? tab : latest));
	const busy = acting.includes(active.chat);
	const [error, setError] = useState<string | null>(null);
	const [suggesting, setSuggesting] = useState(false);
	useEffect(() => setError(null), [active.targetId, active.url]);
	useEffect(
		() =>
			window.browserPane.onManagePasswords(() => {
				window.location.hash = '#/settings/browser/passwords';
			}),
		[]
	);
	const run = (
		targetId: string,
		command: BrowserPaneCommand['command'],
		url?: string,
		index?: number,
		route?: BrowserRoute
	): void => {
		setError(null);
		void window.browserPane
			.command({ targetId, command, url, index, route })
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
	};

	return (
		<section
			aria-label="Browser"
			data-browser-pane
			className="flex h-full min-w-0 flex-col bg-background"
			// On macOS the mouse's back and forward buttons over the tab strip and toolbar move the tab;
			// Windows and Linux route them in the main process.
			onMouseUp={(event) => {
				if (!IS_MAC || (event.button !== 3 && event.button !== 4)) return;
				run(active.targetId, event.button === 3 ? 'back' : 'forward');
			}}
		>
			<BrowserTabs
				tabs={tabs}
				active={active.targetId}
				onSelect={(targetId) => run(targetId, 'focus')}
				onClose={(targetId) => run(targetId, 'close')}
				onNew={(route) => run(active.targetId, 'new', undefined, undefined, route)}
				onMove={(targetId, index) => run(targetId, 'move', undefined, index)}
			/>
			<BrowserToolbar
				key={active.targetId}
				tab={active}
				onCommand={(command, url) => run(active.targetId, command, url)}
				onStopAgent={busy && active.chat === chat ? onStop : undefined}
				onClose={onClose}
				onSuggestionsOpen={setSuggesting}
			/>
			{active.offer ? (
				<BrowserOffer
					offer={active.offer}
					onAnswer={(answer) =>
						void window.browserPane
							.passwordsOffer(active.targetId, answer)
							.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
					}
				/>
			) : null}
			{active.download ? (
				<BrowserDownloadBar
					download={active.download}
					onAnswer={(answer) =>
						void window.browserPane
							.downloadAnswer(active.targetId, answer)
							.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
					}
				/>
			) : null}
			{active.permission ? (
				<BrowserPermissionBar
					permission={active.permission}
					onAnswer={(answer) =>
						void window.browserPane
							.permissionAnswer(active.targetId, answer)
							.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
					}
				/>
			) : null}
			{error ? (
				<p role="alert" className="shrink-0 truncate px-3 py-1 text-xs text-destructive">
					{error}
				</p>
			) : null}
			<div
				className={cn(
					'flex min-h-0 flex-1 flex-col border-2 border-transparent transition-colors',
					busy && 'border-primary'
				)}
			>
				{busy ? (
					<span role="status" className="sr-only">
						The assistant is using this page
					</span>
				) : null}
				<BrowserScreen targetId={active.targetId} error={active.error} suppressed={suggesting} />
			</div>
		</section>
	);
}
