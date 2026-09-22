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
						<SettingsBreadcrumb />
						<Outlet />
					</div>
				</div>
			</Split>
		</PageContainer>
	);
}
