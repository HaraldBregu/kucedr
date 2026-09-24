import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { SettingsBreadcrumb } from './Breadcrumb';
import { SettingsSidebar } from './Sidebar';

export function Layout(): React.JSX.Element {
	const { pathname } = useLocation();
	const isSubroute = pathname.slice('/settings/'.length).includes('/');

	return (
		<PageContainer className="bg-muted/20">
			<Split sidebar={<SettingsSidebar />}>
				<div data-slot="settings-workspace" className="min-h-0 flex-1 overflow-y-auto">
					<div className="pb-6">
						{isSubroute ? (
							<div
								data-slot="settings-breadcrumb-shell"
								className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm"
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
