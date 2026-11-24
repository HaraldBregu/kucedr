import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { ChevronDown, Globe, Loader2, Plus, VenetianMask, X } from 'lucide-react';
import type { BrowserPaneTab, BrowserRoute } from '../../../../../shared/browser';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROUTE_LOOKS } from './routes';

const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as CSSProperties;
const TAB_MIME = 'application/x-browser-tab';
const IS_MAC = navigator.platform.startsWith('Mac');
const EDGE = 32;
const SCROLL_STEP = 12;

export function BrowserTabs({
	tabs,
	active,
	onSelect,
	onClose,
	onNew,
	onMove,
}: {
	readonly tabs: readonly BrowserPaneTab[];
	readonly active: string;
	readonly onSelect: (targetId: string) => void;
	readonly onClose: (targetId: string) => void;
	readonly onNew: (route?: BrowserRoute) => void;
	readonly onMove: (targetId: string, index: number) => void;
}): ReactElement {
	const list = useRef<HTMLDivElement>(null);
	const moved = useRef<string | null>(null);
	const [drop, setDrop] = useState<number | null>(null);
	useEffect(() => {
		list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
	}, [active, tabs.length]);
	useEffect(() => {
		if (!moved.current) return;
		list.current?.querySelector<HTMLElement>(`[data-tab="${moved.current}"] [role="tab"]`)?.focus();
		moved.current = null;
	}, [tabs]);
	const crowded = tabs.length > 5;

	return (
		<div className="flex h-10 shrink-0 items-end gap-0.5 bg-muted px-2 pt-1.5" style={DRAG}>
			<div
				ref={list}
				role="tablist"
				aria-label="Browser tabs"
				style={NO_DRAG}
				className={cn(
					'flex min-w-0 items-end overflow-x-auto transition-[padding] [scrollbar-width:none]',
					drop === tabs.length && 'pr-12'
				)}
				onWheel={(event) => {
					if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
				}}
				onDragOver={(event) => {
					if (!event.dataTransfer.types.includes(TAB_MIME)) return;
					event.preventDefault();
					event.dataTransfer.dropEffect = 'move';
					const box = event.currentTarget.getBoundingClientRect();
					if (event.clientX < box.left + EDGE) event.currentTarget.scrollLeft -= SCROLL_STEP;
					else if (event.clientX > box.right - EDGE) event.currentTarget.scrollLeft += SCROLL_STEP;
					const items = [...event.currentTarget.querySelectorAll('[data-tab]')];
					const at = items.findIndex((item) => {
						const rect = item.getBoundingClientRect();
						return event.clientX < rect.left + rect.width / 2;
					});
					setDrop(at < 0 ? items.length : at);
				}}
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
				}}
				onDrop={(event) => {
					const targetId = event.dataTransfer.getData(TAB_MIME);
					const slot = drop;
					setDrop(null);
					if (!targetId || slot === null) return;
					event.preventDefault();
					const from = tabs.findIndex((tab) => tab.targetId === targetId);
					onMove(targetId, from < slot ? slot - 1 : slot);
				}}
			>
				{tabs.map((tab, at) => {
					const selected = tab.targetId === active;
					const label = tab.title || (!tab.url || tab.url === 'about:blank' ? 'New tab' : tab.url);
					const look = tab.route === 'direct' ? undefined : ROUTE_LOOKS[tab.route];
					return (
						<div
							key={tab.targetId}
							data-tab={tab.targetId}
							draggable
							onDragStart={(event) => {
								event.dataTransfer.setData(TAB_MIME, tab.targetId);
								event.dataTransfer.effectAllowed = 'move';
							}}
							onDragEnd={() => setDrop(null)}
							className={cn(
								'group/tab relative flex h-8.5 w-52 min-w-28 shrink items-center rounded-t-lg text-xs transition-[margin]',
								drop === at && 'ml-12',
								selected
									? 'bg-background text-foreground'
									: 'text-muted-foreground after:absolute after:right-0 after:top-2 after:h-4 after:w-px after:bg-border hover:bg-background/50 hover:text-foreground'
							)}
						>
							<button
								type="button"
								role="tab"
								aria-selected={selected}
								aria-keyshortcuts={
									IS_MAC
										? 'Meta+Shift+ArrowLeft Meta+Shift+ArrowRight'
										: 'Control+Shift+ArrowLeft Control+Shift+ArrowRight'
								}
								title={look ? `${label} (${look.label} tab)` : label}
								className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-t-lg pl-3 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
								onClick={() => onSelect(tab.targetId)}
								onAuxClick={(event) => {
									if (event.button === 1) onClose(tab.targetId);
								}}
								onKeyDown={(event) => {
									const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
									const modifier = IS_MAC ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
									if (!step || !modifier || !event.shiftKey || event.altKey) return;
									event.preventDefault();
									const index = at + step;
									if (index < 0 || index >= tabs.length) return;
									moved.current = tab.targetId;
									onMove(tab.targetId, index);
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
