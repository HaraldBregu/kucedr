import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSettingsBreadcrumbItems } from './hooks';

export function SettingsBreadcrumb(): React.JSX.Element | null {
	const { t } = useTranslation();
	const items = useSettingsBreadcrumbItems();

	if (items.length === 0) return null;

	return (
		<nav
			data-slot="settings-breadcrumb"
			aria-label={t('settings.breadcrumb.label')}
			className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground"
		>
			{items.map((item, index) => (
				<React.Fragment key={`${item.label}-${index}`}>
					{index > 0 ? (
						<ChevronRight className="size-3 shrink-0 text-muted-foreground/60" strokeWidth={1.8} />
					) : null}
					{item.path ? (
						<Link
							to={item.path}
							className="min-w-0 rounded-sm font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55"
							style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
						>
							{item.label}
						</Link>
					) : (
						<span className="min-w-0 truncate font-medium text-foreground">{item.label}</span>
					)}
				</React.Fragment>
			))}
		</nav>
	);
}
