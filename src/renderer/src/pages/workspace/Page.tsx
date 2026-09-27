import { PageContainer, Split } from '@/components/app/base/page';
import { WorkspaceSidebar } from './Sidebar';

export default function WorkspacePage(): React.JSX.Element {
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<WorkspaceSidebar />} sidebarLabel="Workspace files">
				<div data-slot="workspace-content" className="min-h-0 flex-1 bg-background" />
			</Split>
		</PageContainer>
	);
}
