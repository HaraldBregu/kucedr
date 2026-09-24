import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { SPLIT_ITEM_CLASS, usePageContext } from '@/components/app/base/page';
import { SidebarFooter } from '@/components/ui/sidebar';
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
			['/settings/account', '/settings/general', '/settings/cloud', '/settings/providers'].includes(
				item.path
			)
		),
	},
	{
		id: 'assistant',
		titleKey: 'settings.overview.groups.assistant',
		items: [
			...SETTINGS_MODEL_SERVICE_ITEMS.filter((item) => item.id === AGENTS.assistant),
			...SETTINGS_NAVIGATION.filter((item) =>
				[
					'/settings/voice',
					'/settings/tasks',
					'/settings/health',
					'/settings/channels',
					'/settings/remote-agent',
				].includes(item.path)
			),
			...SETTINGS_MODEL_SERVICE_ITEMS.filter((item) => item.id === AGENTS.coding),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/memory'),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/knowledge-base'),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/skills'),
			...SETTINGS_NAVIGATION.filter((item) => item.path === '/settings/mcp'),
		],
	},
] as const;

const SETTINGS_SIDEBAR_BOTTOM_ITEMS = SETTINGS_NAVIGATION.filter((item) =>
	['/settings/plugins', '/settings/apps'].includes(item.path)
);

const SETTINGS_SIDEBAR_ITEMS = [
	...SETTINGS_SIDEBAR_GROUPS.flatMap<SettingsNavigationItem>((group) => group.items),
	...SETTINGS_SIDEBAR_BOTTOM_ITEMS,
];

export function SettingsSidebar(): React.JSX.Element {
	const { t } = useTranslation();
	const location = useLocation();
	const { isMobile, dispatch } = usePageContext();
	const activePath = SETTINGS_SIDEBAR_ITEMS.reduce((currentPath, item) => {
		const matches =
			location.pathname === item.path ||
			(item.path !== '/settings' && location.pathname.startsWith(`${item.path}/`));
		return matches && item.path.length > currentPath.length ? item.path : currentPath;
	}, '');

	return (
		<div data-slot="settings-sidebar" className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 border-b border-sidebar-border/50 p-2">
				<Link
					to="/home"
					className={cn(SPLIT_ITEM_CLASS, 'group')}
					onClick={() => {
						if (isMobile) dispatch({ type: 'SIDEBAR_OPEN_MOBILE_SET', open: false });
					}}
				>
					<ArrowLeft
						className="size-4 shrink-0 transition-transform duration-300 ease-in-out group-hover:delay-75 group-hover:scale-110 motion-reduce:transition-none"
						strokeWidth={1.8}
					/>
					<span>{t('settings.returnToChat', 'Return to Home')}</span>
				</Link>
			</div>
			<nav aria-label={t('settings.title')} className="flex min-h-0 flex-1 flex-col">
				<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4 pt-3">
					{SETTINGS_SIDEBAR_GROUPS.map((group, index) => (
						<Group
							key={group.id}
							items={group.items}
							titleKey={'titleKey' in group ? group.titleKey : undefined}
							activePath={activePath}
							className={cn('first:pt-0', index > 0 && 'mt-3')}
						/>
					))}
				</div>
				<SidebarFooter className="shrink-0 gap-0 border-t border-sidebar-border/50 p-0">
					<Group
						items={SETTINGS_SIDEBAR_BOTTOM_ITEMS}
						titleKey="settings.overview.groups.extensions"
						activePath={activePath}
						className="py-3"
					/>
				</SidebarFooter>
			</nav>
		</div>
	);
}
