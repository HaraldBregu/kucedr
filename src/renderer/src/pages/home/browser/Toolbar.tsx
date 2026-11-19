import { useEffect, useState, type ReactElement } from 'react';
import { ArrowLeft, ArrowRight, PanelRightClose, RotateCw, X } from 'lucide-react';
import type { BrowserPaneCommand, BrowserPaneTab } from '../../../../../shared/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function BrowserToolbar({
	tab,
	acting,
	onCommand,
	onClose,
}: {
	readonly tab: BrowserPaneTab;
	readonly acting: boolean;
	readonly onCommand: (command: BrowserPaneCommand['command'], url?: string) => void;
	readonly onClose: () => void;
}): ReactElement {
	const [address, setAddress] = useState(tab.url);
	useEffect(() => {
		if (!tab.url.startsWith('chrome-error:')) setAddress(tab.url);
	}, [tab.url, tab.targetId]);
	const actions = [
		{ label: 'Back', icon: ArrowLeft, run: () => onCommand('back') },
		{ label: 'Forward', icon: ArrowRight, run: () => onCommand('forward') },
		tab.loading
			? { label: 'Stop loading', icon: X, run: () => onCommand('stop') }
			: { label: 'Reload', icon: RotateCw, run: () => onCommand('reload') },
	];
	const close = { label: 'Hide browser', icon: PanelRightClose, run: onClose };

	return (
		<>
			<div className="flex h-12 shrink-0 items-center gap-1 px-2">
				{actions.map(({ label, icon: Icon, run }) => (
					<Tooltip key={label}>
						<TooltipTrigger
							render={
								<Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={run}>
									<Icon />
								</Button>
							}
						/>
						<TooltipContent side="bottom">{label}</TooltipContent>
					</Tooltip>
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
						value={address}
						spellCheck={false}
						className="h-7 px-2 text-xs md:text-xs"
						onChange={(event) => setAddress(event.target.value)}
						onFocus={(event) => event.target.select()}
					/>
				</form>
				{acting ? (
					<span
						role="status"
						aria-label="The assistant is using this page"
						title="The assistant is using this page"
						className="mx-1 size-2 shrink-0 animate-pulse rounded-full bg-primary"
					/>
				) : null}
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={close.label}
								onClick={close.run}
							>
								<close.icon />
							</Button>
						}
					/>
					<TooltipContent side="bottom">{close.label}</TooltipContent>
				</Tooltip>
			</div>
			<div className={cn('h-0.5 shrink-0 bg-border', tab.loading && 'animate-pulse bg-primary')} />
		</>
	);
}
