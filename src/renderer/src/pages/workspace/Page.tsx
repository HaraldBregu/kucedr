import { useEffect, useRef, useState } from 'react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { WorkspaceSidebar } from './Sidebar';
import { WorkspaceViewer } from './Viewer';

export default function WorkspacePage({ active }: { readonly active: boolean }): React.JSX.Element {
	const [selectedFile, setSelectedFile] = useState<WorkspaceTreeEntry | null>(null);
	const [fileRevision, setFileRevision] = useState(0);
	const changedWhileHidden = useRef(false);
	useEffect(() => window.agent.onWorkspaceChanged((event) => {
		if (!active && event.type === 'change' && event.path === selectedFile?.path) changedWhileHidden.current = true;
	}), [active, selectedFile?.path]);
	useEffect(() => {
		if (active && changedWhileHidden.current) {
			changedWhileHidden.current = false;
			setFileRevision((revision) => revision + 1);
		}
	}, [active]);
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
				<WorkspaceViewer key={`${selectedFile?.path}:${fileRevision}`} file={selectedFile} />
			</Split>
		</PageContainer>
	);
}
