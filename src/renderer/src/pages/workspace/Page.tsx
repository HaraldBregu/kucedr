import { useState } from 'react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { WorkspaceSidebar } from './Sidebar';
import { WorkspaceViewer } from './Viewer';

export default function WorkspacePage(): React.JSX.Element {
	const [selectedFile, setSelectedFile] = useState<WorkspaceTreeEntry | null>(null);
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<WorkspaceSidebar onFileSelect={setSelectedFile} onEntryRenamed={(sourcePath, nextPath) => {
				setSelectedFile((current) => {
					if (!current) return null;
					if (current.path === sourcePath) return { ...current, path: nextPath, name: nextPath.split(/[\\/]/).pop() ?? current.name };
					if (!current.path.startsWith(`${sourcePath}/`) && !current.path.startsWith(`${sourcePath}\\`)) return current;
					return { ...current, path: `${nextPath}/${current.path.slice(sourcePath.length + 1)}` };
				});
			}} onEntryDeleted={(path) => {
				setSelectedFile((current) => current && (current.path === path || current.path.startsWith(`${path}/`) || current.path.startsWith(`${path}\\`)) ? null : current);
			}} selectedPath={selectedFile?.path ?? null} />} sidebarLabel="Workspace files">
				<WorkspaceViewer key={selectedFile?.path} file={selectedFile} />
			</Split>
		</PageContainer>
	);
}
