import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SPLIT_ITEM_ACTIVE_CLASS, SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { SettingsNavigationItem } from './navigation';

interface GroupProps {
	readonly items: readonly SettingsNavigationItem[];
	readonly titleKey?: string;
	readonly activePath: string;
	readonly className?: string;
}

export function Group({ items, titleKey, activePath, className }: GroupProps): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<section data-slot="split-pane-group" className={cn('px-2 py-1', className)}>
			{titleKey && (
				<h2 className="flex h-7 items-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
					{t(titleKey)}
				</h2>
			)}
			<SidebarMenu>
				{items.map((item) => {
					const Icon = item.icon;
					const isActive = item.path === activePath;

					return (
						<SidebarMenuItem key={item.path}>
							<Link
								to={item.path}
								data-active={isActive ? '' : undefined}
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									SPLIT_ITEM_CLASS,
									isActive && SPLIT_ITEM_ACTIVE_CLASS,
									!isActive && 'group'
								)}
							>
								<Icon
									className="size-4 shrink-0 transition-transform duration-300 ease-in-out group-hover:delay-75 group-hover:scale-110 motion-reduce:transition-none"
									strokeWidth={1.8}
								/>
								<span>{t(item.sidebarLabelKey ?? item.labelKey)}</span>
							</Link>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</section>
	);
}
