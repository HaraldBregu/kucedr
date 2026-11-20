import { useEffect, useState, type ReactElement } from 'react';
import { ArrowLeft, ArrowRight, PanelRightClose, RotateCw, Star, X } from 'lucide-react';
import type { BrowserPaneCommand, BrowserPaneTab } from '../../../../../shared/browser';
import type { BrowserPlace } from '../../../../../shared/browser_import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function BrowserToolbar({
	tab,
	onCommand,
	onClose,
}: {
	readonly tab: BrowserPaneTab;
	readonly onCommand: (command: BrowserPaneCommand['command'], url?: string) => void;
	readonly onClose: () => void;
}): ReactElement {
	const blank = tab.url === 'about:blank' || tab.url === '';
	const [address, setAddress] = useState(blank ? '' : tab.url);
	useEffect(() => {
		if (!tab.error) setAddress(blank ? '' : tab.url);
	}, [tab.url, tab.error, blank]);
	const [suggestions, setSuggestions] = useState<BrowserPlace[]>([]);
	const actions = [
		{ label: 'Back', icon: ArrowLeft, disabled: !tab.back, run: () => onCommand('back') },
		{ label: 'Forward', icon: ArrowRight, disabled: !tab.forward, run: () => onCommand('forward') },
		tab.loading
			? { label: 'Stop loading', icon: X, disabled: false, run: () => onCommand('stop') }
			: { label: 'Reload', icon: RotateCw, disabled: false, run: () => onCommand('reload') },
	];

	return (
		<>
			<div className="flex h-10 shrink-0 items-center gap-1 px-2">
				{actions.map(({ label, icon: Icon, disabled, run }) => (
					<Button
						key={label}
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						title={label}
						disabled={disabled}
						onClick={run}
					>
						<Icon />
					</Button>
				))}
				<form
					className="min-w-0 flex-1"
					onSubmit={(event) => {
						event.preventDefault();
						onCommand('navigate', address);
					}}
				>
					<Input
						aria-label="Address"
						placeholder="Search or enter an address"
						list="browser-suggestions"
						autoComplete="off"
						autoFocus={blank}
						value={address}
						spellCheck={false}
						className="h-7 rounded-full bg-muted px-3 text-xs md:text-xs"
						onChange={(event) => {
							setAddress(event.target.value);
							void window.browserPane
								.suggest(event.target.value)
								.then(setSuggestions)
								.catch(() => undefined);
						}}
						onFocus={(event) => event.target.select()}
					/>
					<datalist id="browser-suggestions">
						{suggestions.map((place) => (
							<option key={place.url} value={place.url} label={place.title} />
						))}
					</datalist>
				</form>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Bookmarks"
					title="Bookmarks"
					onClick={() =>
						void window.browserPane.bookmarks().then(async (bookmarks) => {
							const choice = await window.win.showContextMenu(
								bookmarks.length
									? bookmarks.slice(0, 60).map((place, index) => ({
											id: String(index),
											label: (place.title || place.url).slice(0, 70),
										}))
									: [{ id: 'import', label: 'Import bookmarks from another browser…' }]
							);
							if (choice === 'import') window.location.hash = '#/settings/browser';
							else if (choice !== null) onCommand('navigate', bookmarks[Number(choice)].url);
						})
					}
				>
					<Star />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Hide browser"
					title="Hide browser"
					onClick={onClose}
				>
					<PanelRightClose />
				</Button>
			</div>
			<div className={cn('h-0.5 shrink-0 bg-border', tab.loading && 'animate-pulse bg-primary')} />
		</>
	);
}
