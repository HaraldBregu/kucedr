import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { SettingsBreadcrumb } from './Breadcrumb';
import { SettingsSidebar } from './Sidebar';

export function Layout(): React.JSX.Element {
	const { pathname } = useLocation();
	const isWorkbench = pathname === '/settings/code' || pathname.startsWith('/settings/code/');

	return (
		<PageContainer className="bg-muted/20">
			<Split overlayNavigation sidebar={<SettingsSidebar />} navigationContent={<SettingsBreadcrumb />}>
				<div data-slot="settings-workspace" className={isWorkbench ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
					<div className={isWorkbench ? "h-full pt-12" : "pb-6 pt-12"}>
						<Outlet />
					</div>
				</div>
			</Split>
		</PageContainer>
	);
}
