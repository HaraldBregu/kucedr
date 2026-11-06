import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { BreadcrumbMenu } from './BreadcrumbMenu';
import { useSettingsBreadcrumbItems } from './hooks';
import { SETTINGS_DETAIL_ITEMS } from './navigation';
import { SETTINGS_SIDEBAR_ITEMS } from './Sidebar';

export function SettingsBreadcrumb(): React.JSX.Element {
	const { t } = useTranslation();
	const { pathname } = useLocation();
	const items = useSettingsBreadcrumbItems();
	const sectionPath = `/settings/${pathname.split('/')[2]}`;
	const sections = SETTINGS_SIDEBAR_ITEMS.map((item) => ({
		path: item.path,
		label: t(item.sidebarLabelKey ?? item.labelKey),
	}));
	const subpages = SETTINGS_DETAIL_ITEMS.filter((item) => item.path.startsWith(`${sectionPath}/`)).map((item) => ({
		path: item.path,
		label: t(item.labelKey),
	}));
	const siblings = subpages.length > 0 ? [...sections.filter((section) => section.path === sectionPath), ...subpages] : [];

	return (
		<nav
			data-slot="settings-breadcrumb"
			aria-label={t('settings.breadcrumb.label')}
			className="flex min-w-0 items-center text-xs text-muted-foreground"
		>
			<BreadcrumbMenu label={t('settings.title')} activePath={sectionPath} options={sections} />
			{items.map((item, index) => (
				<React.Fragment key={`${item.label}-${index}`}>
					<ChevronRight aria-hidden="true" className="mx-0.5 size-3 shrink-0 text-muted-foreground/60" strokeWidth={1.8} />
					{item.path ? (
						<Link
							to={item.path}
							className="min-w-0 truncate rounded-sm px-1.5 font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55"
						>
							{item.label}
						</Link>
					) : siblings.length > 0 ? (
						<BreadcrumbMenu label={item.label} activePath={pathname} options={siblings} />
					) : (
						<span className="min-w-0 truncate px-1.5 font-medium text-foreground">{item.label}</span>
					)}
				</React.Fragment>
			))}
		</nav>
	);
}
