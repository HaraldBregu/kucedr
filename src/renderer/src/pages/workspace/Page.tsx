import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { WorkspaceSidebar } from './Sidebar';
import { WorkspaceViewer } from './Viewer';

const SELECTED_FILE_KEY = 'workspace-selected-file';

export default function WorkspacePage({ active }: { readonly active: boolean }): React.JSX.Element {
	const [files, setFiles] = useState<WorkspaceTreeEntry[]>([]);
	const [selectedFile, setSelectedFile] = useState<WorkspaceTreeEntry | null>(() => {
		const path = localStorage.getItem(SELECTED_FILE_KEY);
		return path ? { type: 'file', path, name: path.split(/[\\/]/).pop() ?? path } : null;
	});
	const [fileRevision, setFileRevision] = useState(0);
	const changedWhileHidden = useRef(false);
	useEffect(() => {
		if (selectedFile) localStorage.setItem(SELECTED_FILE_KEY, selectedFile.path);
		else localStorage.removeItem(SELECTED_FILE_KEY);
	}, [selectedFile]);
	useEffect(() => window.agent.onWorkspaceChanged((event) => {
		if (!active && event.type === 'change' && event.path === selectedFile?.path) changedWhileHidden.current = true;
	}), [active, selectedFile?.path]);
	useEffect(() => {
		if (active && changedWhileHidden.current) {
			changedWhileHidden.current = false;
			setFileRevision((revision) => revision + 1);
		}
	}, [active]);
	const handleFilesLoaded = useCallback((files: WorkspaceTreeEntry[]) => {
		setFiles(files);
		setSelectedFile((current) => {
			if (!current) return null;
			const pending = [...files];
			while (pending.length > 0) {
				const entry = pending.pop()!;
				if (entry.path === current.path) {
					if (entry.type !== 'file') return null;
					return entry.name === current.name && entry.size === current.size && entry.createdAt === current.createdAt && entry.updatedAt === current.updatedAt ? current : entry;
				}
				if (entry.children) pending.push(...entry.children);
			}
			return null;
		});
	}, []);
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<WorkspaceSidebar onFileSelect={setSelectedFile} onFilesLoaded={handleFilesLoaded} onEntryRenamed={(sourcePath, nextPath) => {
				setSelectedFile((current) => {
					if (!current) return null;
					if (current.path === sourcePath) return { ...current, path: nextPath, name: nextPath.split(/[\\/]/).pop() ?? current.name };
					if (!current.path.startsWith(`${sourcePath}/`) && !current.path.startsWith(`${sourcePath}\\`)) return current;
					return { ...current, path: `${nextPath}/${current.path.slice(sourcePath.length + 1)}` };
				});
			}} onEntryDeleted={(path) => {
				setSelectedFile((current) => current && (current.path === path || current.path.startsWith(`${path}/`) || current.path.startsWith(`${path}\\`)) ? null : current);
			}} selectedPath={selectedFile?.path ?? null} />} sidebarLabel="Workspace files">
				<WorkspaceViewer key={`${selectedFile?.path}:${fileRevision}`} file={selectedFile} entries={files} onFileSelect={setSelectedFile} />
			</Split>
		</PageContainer>
	);
}
