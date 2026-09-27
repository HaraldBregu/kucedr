import { useState } from 'react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { WorkspaceSidebar } from './Sidebar';
import { WorkspaceViewer } from './Viewer';

export default function WorkspacePage(): React.JSX.Element {
	const [selectedFile, setSelectedFile] = useState<WorkspaceTreeEntry | null>(null);
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<WorkspaceSidebar onFileSelect={setSelectedFile} selectedPath={selectedFile?.path ?? null} />} sidebarLabel="Workspace files">
				<WorkspaceViewer key={selectedFile?.path} file={selectedFile} />
			</Split>
		</PageContainer>
	);
}
