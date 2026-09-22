import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Settings, type LucideIcon } from 'lucide-react';
import {
	CommandDialog,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from '@/components/ui/command';
import {
	SETTINGS_DETAIL_ITEMS,
	SETTINGS_NAVIGATION,
	type SettingsDetailItem,
} from '@/pages/settings/navigation';

interface AppRouteItem {
	readonly id: string;
	readonly label: string;
	readonly description?: string;
	readonly icon: LucideIcon;
	readonly path: string;
	readonly searchValue: string;
	readonly keywords: string[];
}

interface StaticRouteDefinition {
	readonly id: string;
	readonly labelKey: string;
	readonly descriptionKey: string;
	readonly icon: LucideIcon;
	readonly path: string;
	readonly keywords: string;
}

const MIN_SEARCH_LENGTH = 2;

function filterCommandItem(value: string, query: string, keywords?: string[]): number {
	const term = query.trim().toLowerCase();
	if (term.length < MIN_SEARCH_LENGTH) return 1;
	const haystack = [value, ...(keywords ?? [])].join(' ').toLowerCase();
	return term.split(/\s+/).every((token) => haystack.includes(token)) ? 1 : 0;
}

const TOP_LEVEL_ROUTES: readonly StaticRouteDefinition[] = [
	{
		id: 'route-home',
		labelKey: 'command.routes.home.title',
		descriptionKey: 'command.routes.home.description',
		icon: Home,
		path: '/home',
		keywords: 'chat agent ai assistant kucedr',
	},
	{
		id: 'route-settings',
		labelKey: 'command.routes.settings.title',
		descriptionKey: 'command.routes.settings.description',
		icon: Settings,
		path: '/settings/general',
		keywords: 'preferences configuration settings',
	},
] as const;

function toKeywords(...values: Array<string | undefined>): string[] {
	const seen = new Set<string>();
	const keywords: string[] = [];

	for (const value of values) {
		for (const token of (value ?? '').toLowerCase().split(/[\s/._:-]+/)) {
			if (!token || seen.has(token)) continue;
			seen.add(token);
			keywords.push(token);
		}
	}

	return keywords;
}

function createCommandItem({
	id,
	label,
	description,
	icon,
	path,
	keywords,
}: Omit<AppRouteItem, 'searchValue' | 'keywords'> & {
	readonly keywords?: string;
}): AppRouteItem {
	const keywordList = toKeywords(label, description, keywords);

	return {
		id,
		label,
		description,
		icon,
		path,
		keywords: keywordList,
		searchValue: [label, description, keywords].filter(Boolean).join(' '),
	};
}

function getSettingsRouteIcon(path: string): LucideIcon {
	return (
		SETTINGS_NAVIGATION.find((item) => path === item.path || path.startsWith(`${item.path}/`))
			?.icon ?? Settings
	);
}

function mapSettingsDetailItem(item: SettingsDetailItem, t: TFunction): AppRouteItem {
	return createCommandItem({
		id: `settings-detail-${item.path}-${item.labelKey}`,
		label: t(item.labelKey),
		description: item.descriptionKey ? t(item.descriptionKey) : undefined,
		icon: item.icon ?? getSettingsRouteIcon(item.path),
		path: item.path,
		keywords: item.keywords,
	});
}

function buildCommandItems(t: TFunction): {
	readonly visibleItems: AppRouteItem[];
	readonly searchOnlyItems: AppRouteItem[];
} {
	const settingsPagePaths = new Set(SETTINGS_NAVIGATION.map((item) => item.path));

	const routes = TOP_LEVEL_ROUTES.map((route) =>
		createCommandItem({
			id: route.id,
			label: t(route.labelKey),
			description: t(route.descriptionKey),
			icon: route.icon,
			path: route.path,
			keywords: route.keywords,
		})
	);

	const settingsRoutes = SETTINGS_NAVIGATION.filter((item) => !item.comingSoon).map((item) =>
		createCommandItem({
			id: `settings-route-${item.path}`,
			label: t(item.labelKey),
			description: t(item.descriptionKey),
			icon: item.icon,
			path: item.path,
		})
	);
	const deepSettingsItems = SETTINGS_DETAIL_ITEMS.filter(
		(item) => item.path.startsWith('/settings/') && !settingsPagePaths.has(item.path)
	).map((item) => mapSettingsDetailItem(item, t));
	const searchOnlyItems = SETTINGS_DETAIL_ITEMS.filter(
		(item) => item.path.startsWith('/settings/') && settingsPagePaths.has(item.path)
	).map((item) => mapSettingsDetailItem(item, t));

	return {
		visibleItems: [...routes, ...settingsRoutes, ...deepSettingsItems],
		searchOnlyItems,
	};
}

function CommandMenuItem({
	item,
	onSelect,
}: {
	readonly item: AppRouteItem;
	readonly onSelect: (path: string) => void;
}): React.JSX.Element {
	const Icon = item.icon;

	return (
		<CommandItem
			value={item.searchValue}
			keywords={item.keywords}
			onSelect={() => onSelect(item.path)}
			className="items-center gap-3 px-2 py-2"
		>
			<span
				data-slot="command-page-icon"
				className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground"
			>
				<Icon className="size-4" aria-hidden="true" strokeWidth={1.8} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-xs font-medium leading-4">{item.label}</span>
				{item.description && (
					<span className="truncate text-xs leading-4 text-muted-foreground">
						{item.description}
					</span>
				)}
			</span>
			<CommandShortcut className="hidden max-w-40 shrink-0 truncate font-mono text-[10px] sm:block">
				{item.path}
			</CommandShortcut>
		</CommandItem>
	);
}

interface CommandMenuProps {
	readonly open?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
}

export function CommandMenu({
	open: controlledOpen,
	onOpenChange,
}: CommandMenuProps = {}): React.JSX.Element {
	const navigate = useNavigate();
	const location = useLocation();
	const { t } = useTranslation();
	const [internalOpen, setInternalOpen] = useState(false);
	const [search, setSearch] = useState('');
	const listRef = useRef<HTMLDivElement>(null);
	const { visibleItems, searchOnlyItems } = useMemo(() => buildCommandItems(t), [t]);
	const allItems = useMemo(
		() => [...visibleItems, ...searchOnlyItems],
		[visibleItems, searchOnlyItems]
	);
	const isSearching = search.trim().length >= MIN_SEARCH_LENGTH;
	const searchEnabled =
		location.pathname === '/home' ||
		location.pathname.startsWith('/home/') ||
		location.pathname === '/settings' ||
		location.pathname.startsWith('/settings/');
	const open = controlledOpen ?? internalOpen;
	const setOpen = useCallback(
		(nextOpen: boolean) => {
			if (controlledOpen === undefined) setInternalOpen(nextOpen);
			onOpenChange?.(nextOpen);
		},
		[controlledOpen, onOpenChange]
	);

	// Filtered results re-render into the scroll container without resetting its
	// position, leaving top matches hidden above the viewport. Scroll to top on
	// every query change so results are always visible.
	useEffect(() => {
		listRef.current?.scrollTo({ top: 0 });
	}, [search]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) setSearch('');
		},
		[setOpen]
	);

	const navigateTo = useCallback(
		(path: string) => {
			setOpen(false);
			navigate(path);
		},
		[navigate, setOpen]
	);

	useEffect(() => {
		const handler = (e: KeyboardEvent): void => {
			const isSettingsShortcut =
				e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.key === ',';
			const isSearchShortcut =
				(e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f';

			if (isSettingsShortcut) {
				e.preventDefault();
				navigateTo('/settings/general');
				return;
			}

			if (isSearchShortcut && searchEnabled) {
				e.preventDefault();
				setOpen(true);
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [navigateTo, searchEnabled, setOpen]);

	return (
		<CommandDialog
			open={searchEnabled && open}
			onOpenChange={handleOpenChange}
			label={t('command.label', 'Route search')}
			filter={filterCommandItem}
			loop
		>
			<CommandInput
				value={search}
				onValueChange={setSearch}
				placeholder={t('command.placeholder', 'Search routes and settings...')}
			/>
			<CommandList ref={listRef}>
				<CommandEmpty>{t('command.empty', 'No matching route or setting.')}</CommandEmpty>
				{(isSearching ? allItems : visibleItems).map((item) => (
					<CommandMenuItem key={item.id} item={item} onSelect={navigateTo} />
				))}
			</CommandList>
		</CommandDialog>
	);
}
