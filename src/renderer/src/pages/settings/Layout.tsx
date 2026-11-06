import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { SettingsBreadcrumb } from './Breadcrumb';
import { SettingsSidebar } from './Sidebar';

export function Layout(): React.JSX.Element {
	const { pathname } = useLocation();
	const isWorkbench = pathname === '/settings/code' || pathname.startsWith('/settings/code/');
	const isSubroute = pathname.slice('/settings/'.length).includes('/');

	return (
		<PageContainer className="bg-muted/20">
			<Split overlayNavigation sidebar={<SettingsSidebar />}>
				<div data-slot="settings-workspace" className={isWorkbench ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
					<div className={isWorkbench ? "h-full pt-12" : "pb-6 pt-12"}>
						{isSubroute && !isWorkbench ? (
							<div
								data-slot="settings-breadcrumb-shell"
								className="sticky top-12 z-10 bg-background/80 backdrop-blur-sm"
							>
								<SettingsBreadcrumb />
							</div>
						) : null}
						<Outlet />
					</div>
				</div>
			</Split>
		</PageContainer>
	);
}
