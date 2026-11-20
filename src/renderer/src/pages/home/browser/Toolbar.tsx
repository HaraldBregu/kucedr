import { useEffect, useState, type ReactElement } from 'react';
import { ArrowLeft, ArrowRight, PanelRightClose, RotateCw, X } from 'lucide-react';
import type { BrowserPaneCommand, BrowserPaneTab } from '../../../../../shared/browser';
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
						placeholder="Enter a web address"
						autoFocus={blank}
						value={address}
						spellCheck={false}
						className="h-7 rounded-full bg-muted px-3 text-xs md:text-xs"
						onChange={(event) => setAddress(event.target.value)}
						onFocus={(event) => event.target.select()}
					/>
				</form>
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
