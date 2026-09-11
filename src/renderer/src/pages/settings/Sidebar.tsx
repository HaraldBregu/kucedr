import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
	SPLIT_ITEM_ACTIVE_CLASS,
	SPLIT_ITEM_CLASS,
	usePageContext,
} from '@/components/app/base/page';
import { cn } from '@/lib/utils';
import {
	SETTINGS_MODEL_SERVICE_ITEMS,
	SETTINGS_NAVIGATION,
	type SettingsNavigationItem,
} from './navigation';
import { AGENTS } from '@/lib/compat';

const SETTINGS_SIDEBAR_GROUPS = [
	{
		id: 'general',
		items: SETTINGS_NAVIGATION.slice(0, 4),
	},
	{
		id: 'assistant',
		titleKey: 'settings.overview.groups.assistant',
		items: [
			...SETTINGS_MODEL_SERVICE_ITEMS.filter(
				(item) => item.id === AGENTS.assistant || item.id === AGENTS.coding
			),
		],
	},
	{
		id: 'providers',
		titleKey: 'settings.tabs.providers',
		items: SETTINGS_NAVIGATION.slice(5, 9),
	},
	{
		id: 'integrations',
		titleKey: 'settings.overview.groups.extensions',
		items: [
			...SETTINGS_NAVIGATION.slice(15, 16),
			...SETTINGS_NAVIGATION.slice(17),
			...SETTINGS_NAVIGATION.slice(16, 17),
		],
	},
] as const;

const SETTINGS_SIDEBAR_ITEMS = SETTINGS_SIDEBAR_GROUPS.flatMap<SettingsNavigationItem>(
	(group) => group.items
);

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
			<header
				aria-hidden="true"
				className="h-12 shrink-0 border-b border-sidebar-border/50 p-0"
				style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
			/>
			<div className="shrink-0 border-b border-sidebar-border/50 p-2">
				<Link
					to="/home"
					className={SPLIT_ITEM_CLASS}
					onClick={() => {
						if (isMobile) dispatch({ type: 'SIDEBAR_OPEN_MOBILE_SET', open: false });
					}}
				>
					<ArrowLeft className="size-4 shrink-0" strokeWidth={1.8} />
					<span>{t('settings.returnToChat', 'Return to Chat')}</span>
				</Link>
			</div>
			<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4 pt-3">
				<nav aria-label={t('settings.title')}>
					{SETTINGS_SIDEBAR_GROUPS.map((group) => (
						<section
							data-slot="split-pane-group"
							key={group.id}
			className={cn(
				'px-2 py-1 first:pt-0',
				group.id === 'integrations' && 'mt-3'
			)}
						>
							{'titleKey' in group ? (
								<h2 className="flex h-7 items-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
									{t(group.titleKey)}
								</h2>
							) : null}
							<ul className="flex min-w-0 flex-col gap-1">
								{group.items.map((item) => {
									const Icon = item.icon;
									const isActive = item.path === activePath;

									return (
										<li key={item.path}>
											<Link
												to={item.path}
												data-active={isActive ? '' : undefined}
												aria-current={isActive ? 'page' : undefined}
												className={cn(SPLIT_ITEM_CLASS, isActive && SPLIT_ITEM_ACTIVE_CLASS)}
											>
												<Icon className="size-4 shrink-0" strokeWidth={1.8} />
												<span>{t(item.labelKey)}</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</section>
					))}
				</nav>
			</div>
		</div>
	);
}
