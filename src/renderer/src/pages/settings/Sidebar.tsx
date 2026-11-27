import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { SPLIT_ITEM_CLASS, usePageContext } from '@/components/app/base/page';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
	SETTINGS_MODEL_SERVICE_ITEMS,
	SETTINGS_NAVIGATION,
	type SettingsNavigationItem,
} from './navigation';
import { AGENTS } from '@/lib/compat';
import { Group } from './Group';

const SETTINGS_SIDEBAR_GROUPS = [
	{
		id: 'general',
		items: SETTINGS_NAVIGATION.filter((item) =>
			[
				'/settings/account',
				'/settings/general',
				'/settings/workspaces',
				'/settings/cloud',
				'/settings/library',
				'/settings/browser',
				'/settings/privacy',
				'/settings/usage',
			].includes(item.path)
		),
	},
	{
		id: 'assistant',
		titleKey: 'settings.overview.groups.assistant',
		items: [
			...SETTINGS_MODEL_SERVICE_ITEMS.filter((item) => item.id === AGENTS.assistant),
			...SETTINGS_NAVIGATION.filter((item) =>
				['/settings/editor', '/settings/voice', '/settings/tasks', '/settings/health'].includes(item.path)
			),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/memory'),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/knowledge'),
		],
	},
	{
		id: 'extensions',
		titleKey: 'settings.overview.groups.extensions',
		items: [
			...SETTINGS_NAVIGATION.filter((item) =>
				['/settings/apps', '/settings/services', '/settings/scripts', '/settings/modes'].includes(
					item.path
				)
			),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/models'),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/skills'),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/mcp'),
		],
	},
] as const;

const SETTINGS_SIDEBAR_FOOTER_ITEMS = SETTINGS_NAVIGATION.filter(
	(item) => item.path === '/settings/plugins'
);

export const SETTINGS_SIDEBAR_ITEMS = SETTINGS_SIDEBAR_GROUPS.flatMap<SettingsNavigationItem>(
	(group) => group.items
).concat(SETTINGS_SIDEBAR_FOOTER_ITEMS);

export function SettingsSidebar(): React.JSX.Element {
	const { t } = useTranslation();
	const location = useLocation();
	const { isMobile, dispatch } = usePageContext();
	const [query, setQuery] = useState('');
	const needle = query.trim().toLowerCase();
	const matches = (item: SettingsNavigationItem): boolean =>
		!needle || t(item.sidebarLabelKey ?? item.labelKey).toLowerCase().includes(needle);
	const groups = SETTINGS_SIDEBAR_GROUPS.map((group) => ({ ...group, items: group.items.filter(matches) })).filter(
		(group) => group.items.length > 0
	);
	const footerItems = SETTINGS_SIDEBAR_FOOTER_ITEMS.filter(matches);
	const activePath = SETTINGS_SIDEBAR_ITEMS.reduce((currentPath, item) => {
		const matches =
			location.pathname === item.path ||
			(item.path !== '/settings' && location.pathname.startsWith(`${item.path}/`));
		return matches && item.path.length > currentPath.length ? item.path : currentPath;
	}, '');

	return (
		<div data-slot="settings-sidebar" className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 border-b border-sidebar-border/50 px-2 pb-2">
				<Link
					to="/home"
					className={cn(SPLIT_ITEM_CLASS, 'h-8')}
					onClick={() => {
						if (isMobile) dispatch({ type: 'SIDEBAR_OPEN_MOBILE_SET', open: false });
					}}
				>
					<ArrowLeft className="size-4 shrink-0" strokeWidth={1.8} />
					<span>{t('settings.returnToChat', 'Back to home')}</span>
				</Link>
				<div className="relative pt-2">
					<Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-[calc(50%+0.25rem)] z-10 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('settings.search', 'Search settings')} aria-label={t('settings.search', 'Search settings')} className="h-8 pl-8" />
				</div>
			</div>
			<nav aria-label={t('settings.title')} className="flex min-h-0 flex-1 flex-col">
				<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4 pt-3">
					{groups.length === 0 && footerItems.length === 0 && (
						<p className="px-4 py-2 text-sm text-muted-foreground">{t('settings.searchEmpty', 'No settings found')}</p>
					)}
					{groups.map((group, index) => (
						<Group
							key={group.id}
							items={group.items}
							titleKey={'titleKey' in group ? group.titleKey : undefined}
							activePath={activePath}
							className={cn('first:pt-0', index > 0 && 'mt-3')}
						/>
					))}
				</div>
				{footerItems.length > 0 && <Group
					items={footerItems}
					activePath={activePath}
					className="shrink-0 border-t border-sidebar-border/50 py-2"
				/>}
			</nav>
		</div>
	);
}
