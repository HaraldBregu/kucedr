import React from 'react';
import { Outlet } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { SettingsBreadcrumb } from './Breadcrumb';
import { SettingsSidebar } from './Sidebar';

export function Layout(): React.JSX.Element {
	return (
		<PageContainer className="bg-muted/20">
			<Split sidebar={<SettingsSidebar />}>
				<div data-slot="settings-workspace" className="min-h-0 flex-1 overflow-y-auto">
					<div className="pb-6">
						<div
							data-slot="settings-breadcrumb-shell"
							className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm"
						>
							<SettingsBreadcrumb />
						</div>
						<Outlet />
					</div>
				</div>
			</Split>
		</PageContainer>
	);
}
