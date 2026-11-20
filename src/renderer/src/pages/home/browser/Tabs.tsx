import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { ChevronDown, Globe, Loader2, Plus, X } from 'lucide-react';
import type { BrowserPaneTab } from '../../../../../shared/browser';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as CSSProperties;

export function BrowserTabs({
	tabs,
	active,
	onSelect,
	onClose,
	onNew,
}: {
	readonly tabs: readonly BrowserPaneTab[];
	readonly active: string;
	readonly onSelect: (targetId: string) => void;
	readonly onClose: (targetId: string) => void;
	readonly onNew: () => void;
}): ReactElement {
	const list = useRef<HTMLDivElement>(null);
	useEffect(() => {
		list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
	}, [active, tabs.length]);
	const crowded = tabs.length > 5;

	return (
		<div className="flex h-10 shrink-0 items-end gap-0.5 bg-muted px-2 pt-1.5" style={DRAG}>
			<div
				ref={list}
				role="tablist"
				aria-label="Browser tabs"
				style={NO_DRAG}
				className="flex min-w-0 items-end overflow-x-auto [scrollbar-width:none]"
				onWheel={(event) => {
					if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
				}}
			>
				{tabs.map((tab) => {
					const selected = tab.targetId === active;
					const label = tab.title || (!tab.url || tab.url === 'about:blank' ? 'New tab' : tab.url);
					return (
						<div
							key={tab.targetId}
							className={cn(
								'group/tab relative flex h-8.5 w-52 min-w-28 shrink items-center rounded-t-lg text-xs',
								selected
									? 'bg-background text-foreground'
									: 'text-muted-foreground after:absolute after:right-0 after:top-2 after:h-4 after:w-px after:bg-border hover:bg-background/50 hover:text-foreground'
							)}
						>
							<button
								type="button"
								role="tab"
								aria-selected={selected}
								title={label}
								className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-t-lg pl-3 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
								onClick={() => onSelect(tab.targetId)}
								onAuxClick={(event) => {
									if (event.button === 1) onClose(tab.targetId);
								}}
							>
								{tab.loading ? (
									<Loader2 className="size-3.5 shrink-0 animate-spin" />
								) : tab.icon ? (
									<img src={tab.icon} alt="" className="size-3.5 shrink-0 rounded-sm" />
								) : (
									<Globe className="size-3.5 shrink-0" />
								)}
								<span className="truncate">{label}</span>
							</button>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label={`Close ${label}`}
								title="Close tab"
								className={cn(
									'mr-1.5 size-5 shrink-0 rounded-full',
									!selected && 'opacity-0 focus-visible:opacity-100 group-hover/tab:opacity-100'
								)}
								onClick={() => onClose(tab.targetId)}
							>
								<X />
							</Button>
						</div>
					);
				})}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label="New tab"
				title="New tab"
				style={NO_DRAG}
				className="mb-1.5 size-6 shrink-0 rounded-full"
				onClick={onNew}
			>
				<Plus />
			</Button>
			{crowded ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label="All tabs"
					title="All tabs"
					style={NO_DRAG}
					className="mb-1.5 ml-auto size-6 shrink-0 rounded-full"
					onClick={() =>
						void window.win
							.showContextMenu(
								tabs.map((tab) => ({
									id: tab.targetId,
									label: (tab.title || tab.url || 'New tab').slice(0, 80),
								}))
							)
							.then((targetId) => {
								if (targetId) onSelect(targetId);
							})
					}
				>
					<ChevronDown />
				</Button>
			) : null}
		</div>
	);
}
