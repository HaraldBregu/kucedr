import { playSound } from '@/lib/sounds/play';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppWindow, Home, Puzzle, Settings, type LucideIcon } from 'lucide-react';
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	SETTINGS_DETAIL_ITEMS,
	SETTINGS_NAVIGATION,
	type SettingsDetailItem,
} from '@/pages/settings/navigation';
import { useOpenApp } from '@/hooks/app';
import type { App } from '@shared/installed_app_types';
import type { PluginInfo } from '@shared/plugin_types';

const CATEGORIES = ['all', 'routes', 'apps', 'plugins', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

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
		path: '/settings/settings',
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
		>
			<Icon className="size-4" aria-hidden="true" />
			<span className="min-w-0 flex-1 truncate">{item.label}</span>
			<CommandShortcut className="hidden max-w-40 shrink-0 truncate font-mono text-[10px] sm:block">
				{item.path}
			</CommandShortcut>
		</CommandItem>
	);
}

function ImageMenuItem({
	title,
	description,
	icon,
	iconDark,
	fallbackIcon: FallbackIcon,
	onSelect,
}: {
	readonly title: string;
	readonly description?: string;
	readonly icon?: string;
	readonly iconDark?: string;
	readonly fallbackIcon: LucideIcon;
	readonly onSelect: () => void;
}): React.JSX.Element {
	return (
		<CommandItem
			value={[title, description].filter(Boolean).join(' ')}
			keywords={toKeywords(title, description)}
			onSelect={onSelect}
		>
			{icon ? (
				<>
					<img
						src={icon}
						alt=""
						className={cn('size-4 object-contain', iconDark && 'dark:hidden')}
					/>
					{iconDark ? (
						<img src={iconDark} alt="" className="hidden size-4 object-contain dark:block" />
					) : null}
				</>
			) : (
				<FallbackIcon className="size-4" aria-hidden="true" />
			)}
			<span className="min-w-0 flex-1 truncate">{title}</span>
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
	const [category, setCategory] = useState<Category>('all');
	const [plugins, setPlugins] = useState<PluginInfo[]>([]);
	const [apps, setApps] = useState<App[]>([]);
	const listRef = useRef<HTMLDivElement>(null);
	const { visibleItems, searchOnlyItems } = useMemo(() => buildCommandItems(t), [t]);
	const isSearching = search.trim().length >= MIN_SEARCH_LENGTH;
	const routeItems = visibleItems.slice(
		0,
		TOP_LEVEL_ROUTES.length + SETTINGS_NAVIGATION.filter((item) => !item.comingSoon).length
	);
	const otherItems = [
		...visibleItems.slice(routeItems.length),
		...(isSearching ? searchOnlyItems : []),
	];
	const searchEnabled =
		location.pathname === '/home' ||
		location.pathname.startsWith('/home/') ||
		location.pathname === '/workspace' ||
		location.pathname === '/code' ||
		location.pathname.startsWith('/code/') ||
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
			if (!nextOpen) {
				setSearch('');
				setCategory('all');
			}
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

	const openApp = useOpenApp();

	useEffect(() => {
		if (!open) return;
		void window.plugins
			.list()
			.then(setPlugins)
			.catch(() => setPlugins([]));
		void window.apps
			.list()
			.then(setApps)
			.catch(() => setApps([]));
	}, [open]);

	const sections = [
		{
			category: 'routes',
			items: routeItems.map((item) => (
				<CommandMenuItem key={item.id} item={item} onSelect={navigateTo} />
			)),
		},
		{
			category: 'apps',
			items: apps.map((app) => (
				<ImageMenuItem
					key={app.id}
					title={app.title}
					description={app.description}
					icon={app.imageUrl}
					fallbackIcon={AppWindow}
					onSelect={() => {
						setOpen(false);
						void openApp(app);
					}}
				/>
			)),
		},
		{
			category: 'plugins',
			items: plugins.map((plugin) => (
				<ImageMenuItem
					key={plugin.id}
					title={plugin.name}
					description={plugin.description}
					icon={plugin.icon}
					iconDark={plugin.iconDark}
					fallbackIcon={Puzzle}
					onSelect={() => navigateTo(`/settings/plugins/${plugin.id}`)}
				/>
			)),
		},
		{
			category: 'other',
			items: otherItems.map((item) => (
				<CommandMenuItem key={item.id} item={item} onSelect={navigateTo} />
			)),
		},
	].filter(
		(section) => (category === 'all' || category === section.category) && section.items.length > 0
	);

	useEffect(() => {
		const handler = (e: KeyboardEvent): void => {
			const isSettingsShortcut =
				e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.key === ',';
			const isSearchShortcut =
				(e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f';

			if (isSettingsShortcut) {
				e.preventDefault();
				playSound('navigate');
				navigateTo('/settings/settings');
				return;
			}

			if (isSearchShortcut && searchEnabled) {
				e.preventDefault();
				playSound('navigate');
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
			label={t('command.label')}
			filter={filterCommandItem}
			loop
		>
			<CommandInput
				value={search}
				onValueChange={setSearch}
				placeholder={t('command.placeholder')}
			/>
			<Tabs
				value={category}
				onValueChange={(value) => setCategory(value as Category)}
				className="border-b px-2 py-1.5"
			>
				<TabsList className="bg-muted/50 group-data-horizontal/tabs:h-7 dark:bg-muted">
					{CATEGORIES.map((value) => (
						<TabsTrigger key={value} value={value} className="px-2 text-xs data-active:bg-popover">
							{t(`command.categories.${value}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<CommandList ref={listRef}>
				{sections.length === 0 ? (
					<Empty className="border-0 py-6">
						<EmptyHeader>
							<EmptyDescription className="text-xs">{t('command.emptyCategory')}</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<CommandEmpty>{t('command.empty')}</CommandEmpty>
				)}
				{sections.map((section, index) => (
					<React.Fragment key={section.category}>
						{index > 0 ? <CommandSeparator /> : null}
						<CommandGroup heading={t(`command.categories.${section.category}`)}>
							{section.items}
						</CommandGroup>
					</React.Fragment>
				))}
			</CommandList>
		</CommandDialog>
	);
}
