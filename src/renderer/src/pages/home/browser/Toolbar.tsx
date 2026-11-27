import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import {
	ArrowLeft,
	ArrowRight,
	BookMarked,
	Globe,
	KeyRound,
	PanelRightClose,
	RotateCw,
	ShieldAlert,
	Square,
	Star,
	X,
} from 'lucide-react';
import type { BrowserBlocked, BrowserPaneCommand, BrowserPaneTab } from '../../../../../shared/browser';
import type { BrowserPlace } from '../../../../../shared/browser_import';
import { loginLabel } from '../../../../../shared/login_label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ROUTE_LOOKS } from './routes';

const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as CSSProperties;
const MENU_BOOKMARKS = 45;
const MENU_BLOCKED = 40;
const BLOCKED_REASONS: Record<BrowserBlocked['reason'], string> = {
	local: 'browserPane.blocked.local',
	secret: 'browserPane.blocked.secret',
	route: 'browserPane.blocked.route',
	download: 'browserPane.blocked.download',
	onion: 'browserPane.blocked.onion',
};

export function BrowserToolbar({
	tab,
	onCommand,
	onStopAgent,
	onClose,
	onSuggestionsOpen,
}: {
	readonly tab: BrowserPaneTab;
	readonly onCommand: (command: BrowserPaneCommand['command'], url?: string) => void;
	readonly onStopAgent?: () => void;
	readonly onClose: () => void;
	readonly onSuggestionsOpen: (open: boolean) => void;
}): ReactElement {
	const blank = tab.url === 'about:blank' || tab.url === '';
	const { t } = useTranslation();
	const [address, setAddress] = useState(blank ? '' : tab.url);
	useEffect(() => {
		if (!tab.error) setAddress(blank ? '' : tab.url);
	}, [tab.url, tab.error, blank]);
	const [suggestions, setSuggestions] = useState<BrowserPlace[]>([]);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const [hasLogins, setHasLogins] = useState(false);
	const [saved, setSaved] = useState(false);
	const web = /^https?:/i.test(tab.url);
	const refreshSaved = (): void =>
		void window.browserPane.bookmarks().then((bookmarks) => setSaved(bookmarks.some((place) => place.url === tab.url)));
	useEffect(refreshSaved, [tab.url]);
	const toggleBookmark = async (): Promise<void> => {
		if (!saved) await window.browserPane.bookmarksAdd({ url: tab.url, title: tab.title });
		else {
			const choice = await window.win.showContextMenu([
				{ id: 'remove', label: 'Remove bookmark' },
				{ id: 'edit', label: 'Edit bookmarks…' },
			]);
			if (choice === 'edit') window.location.hash = '#/settings/browser/bookmarks';
			if (choice === 'remove') await window.browserPane.bookmarksDelete(tab.url);
		}
		refreshSaved();
	};
	const list = suggestions.slice(0, 8);
	const showing = open && list.length > 0;
	useEffect(() => onSuggestionsOpen(showing), [showing, onSuggestionsOpen]);
	useEffect(() => {
		void window.browserPane.passwordsMatch(tab.targetId).then((logins) => setHasLogins(logins.length > 0));
	}, [tab.targetId, tab.url]);
	const close = (): void => {
		setOpen(false);
		setActive(-1);
	};
	const go = (value: string): void => {
		close();
		onCommand('navigate', value);
	};
	const actions = [
		{ label: 'Back', icon: ArrowLeft, disabled: !tab.back, run: () => onCommand('back') },
		{ label: 'Forward', icon: ArrowRight, disabled: !tab.forward, run: () => onCommand('forward') },
		tab.loading
			? { label: 'Stop loading', icon: X, disabled: false, run: () => onCommand('stop') }
			: { label: 'Reload', icon: RotateCw, disabled: false, run: () => onCommand('reload') },
	];
	const look = tab.route === 'direct' ? undefined : ROUTE_LOOKS[tab.route];
	const blocked = tab.blocked ?? [];
	const trailing = [
		{ label: 'Stop the assistant', icon: Square, show: Boolean(onStopAgent), run: () => onStopAgent?.() },
		{
			label: `${blocked.length} blocked ${blocked.length === 1 ? 'request' : 'requests'} on this page`,
			icon: ShieldAlert,
			show: blocked.length > 0,
			run: () =>
				void window.win.showContextMenu(
					blocked
						.slice(-MENU_BLOCKED)
						.reverse()
						.map((item, index) => ({
							id: String(index),
							label: `${t(BLOCKED_REASONS[item.reason])}: ${item.url}`.slice(0, 90),
							enabled: false,
						}))
				),
		},
		{
			label: 'Bookmarks',
			icon: BookMarked,
			show: true,
			run: () =>
				void window.browserPane.bookmarks().then(async (bookmarks) => {
					// Native menus take at most 50 items: the newest bookmarks, then the full list in Settings.
					const recent = bookmarks.slice(-MENU_BOOKMARKS).reverse();
					const choice = await window.win.showContextMenu(
						bookmarks.length
							? [
									...recent.map((place, index) => ({
										id: String(index),
										label: (place.title.trim() || place.url).slice(0, 70),
									})),
									{ type: 'separator' as const },
									{ id: 'all', label: `All bookmarks (${bookmarks.length})…` },
								]
							: [{ id: 'import', label: 'Import bookmarks from another browser…' }]
					);
					if (choice === 'import') window.location.hash = '#/settings/browser';
					else if (choice === 'all') window.location.hash = '#/settings/browser/bookmarks';
					else if (choice !== null) onCommand('navigate', recent[Number(choice)].url);
				}),
		},
		{
			label: 'Fill a saved password',
			icon: KeyRound,
			show: hasLogins,
			run: () =>
				void window.browserPane.passwordsMatch(tab.targetId).then(async (logins) => {
					const choice =
						logins.length === 1
							? logins[0].id
							: await window.win.showContextMenu(
									logins.map((login) => ({ id: login.id, label: loginLabel(login) }))
								);
					if (choice) void window.browserPane.passwordsFill(tab.targetId, choice).catch(() => undefined);
				}),
		},
		{ label: 'Hide browser', icon: PanelRightClose, show: true, run: onClose },
	];

	return (
		<>
			<div className="flex h-10 shrink-0 items-center gap-1 px-2" style={DRAG}>
				{actions.map(({ label, icon: Icon, disabled, run }) => (
					<Button
						key={label}
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						title={label}
						style={NO_DRAG}
						disabled={disabled}
						onClick={run}
					>
						<Icon />
					</Button>
				))}
				{look ? (
					<Badge variant="secondary" title={t(look.hint)} className="h-7 shrink-0 gap-1 px-2.5" style={NO_DRAG}>
						<look.icon aria-hidden="true" />
						{t(look.label)}
						<span className="sr-only">. {t(look.hint)}</span>
					</Badge>
				) : null}
				<div className="relative min-w-0 flex-1" style={NO_DRAG}>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							go(active >= 0 ? list[active].url : address);
						}}
					>
						<Input
							aria-label="Address"
							placeholder="Search or enter an address"
							autoComplete="off"
							autoFocus={blank}
							value={address}
							spellCheck={false}
							className={cn('h-7 rounded-full bg-muted px-3 text-xs md:text-xs', web && 'pr-8')}
							onChange={(event) => {
								setAddress(event.target.value);
								setActive(-1);
								void window.browserPane
									.suggest(event.target.value)
									.then((places) => {
										setSuggestions(places);
										setOpen(true);
									})
									.catch(() => undefined);
							}}
							onFocus={(event) => event.target.select()}
							onBlur={close}
							onKeyDown={(event) => {
								if (!showing) return;
								if (event.key === 'ArrowDown') {
									event.preventDefault();
									setActive((current) => Math.min(current + 1, list.length - 1));
								} else if (event.key === 'ArrowUp') {
									event.preventDefault();
									setActive((current) => Math.max(current - 1, -1));
								} else if (event.key === 'Escape') {
									close();
								}
							}}
						/>
					</form>
					{web ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={saved ? 'Edit bookmark' : 'Bookmark this page'}
							aria-pressed={saved}
							title={saved ? 'Edit bookmark' : 'Bookmark this page'}
							className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full"
							onClick={() => void toggleBookmark().catch(() => undefined)}
						>
							<Star className={cn(saved && 'fill-current')} />
						</Button>
					) : null}
					{showing ? (
						<ul
							role="listbox"
							aria-label="Address suggestions"
							className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 text-xs shadow-lg"
						>
							{list.map((place, index) => (
								<li key={place.url}>
									<button
										type="button"
										role="option"
										aria-selected={index === active}
										className={cn(
											'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
											index === active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
										)}
										onMouseDown={(event) => event.preventDefault()}
										onMouseEnter={() => setActive(index)}
										onClick={() => go(place.url)}
									>
										<Globe className="size-3.5 shrink-0 text-muted-foreground" />
										<span className="flex min-w-0 flex-col">
											{place.title ? <span className="truncate font-medium">{place.title}</span> : null}
											<span className="truncate text-muted-foreground">{place.url}</span>
										</span>
									</button>
								</li>
							))}
						</ul>
					) : null}
				</div>
				{trailing
					.filter((item) => item.show)
					.map(({ label, icon: Icon, run }) => (
						<Button
							key={label}
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={label}
							title={label}
							style={NO_DRAG}
							onClick={run}
						>
							<Icon />
						</Button>
					))}
			</div>
			<div className={cn('h-0.5 shrink-0 bg-border', tab.loading && 'animate-pulse bg-primary')} />
		</>
	);
}
