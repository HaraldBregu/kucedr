import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { WorkspaceSidebar } from './Sidebar';
import { WorkspaceViewer } from './Viewer';

const SELECTED_FILE_KEY = 'workspace-selected-file';

export default function WorkspacePage({ settings = false }: { readonly settings?: boolean }): React.JSX.Element {
	const { t } = useTranslation();
	const [files, setFiles] = useState<WorkspaceTreeEntry[]>([]);
	const [selectedFile, setSelectedFile] = useState<WorkspaceTreeEntry | null>(() => {
		if (settings) return null;
		const path = localStorage.getItem(SELECTED_FILE_KEY);
		return path ? { type: 'file', path, name: path.split(/[\\/]/).pop() ?? path } : null;
	});
	useEffect(() => {
		if (settings) return;
		if (selectedFile) localStorage.setItem(SELECTED_FILE_KEY, selectedFile.path);
		else localStorage.removeItem(SELECTED_FILE_KEY);
	}, [selectedFile, settings]);
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
	const sidebar = <WorkspaceSidebar embedded={settings} onFileSelect={setSelectedFile} onFilesLoaded={handleFilesLoaded} onEntryRenamed={(sourcePath, nextPath) => {
				setSelectedFile((current) => {
					if (!current) return null;
					if (current.path === sourcePath) return { ...current, path: nextPath, name: nextPath.split(/[\\/]/).pop() ?? current.name };
					if (!current.path.startsWith(`${sourcePath}/`) && !current.path.startsWith(`${sourcePath}\\`)) return current;
					return { ...current, path: `${nextPath}/${current.path.slice(sourcePath.length + 1)}` };
				});
			}} onEntryDeleted={(path) => {
				setSelectedFile((current) => current && (current.path === path || current.path.startsWith(`${path}/`) || current.path.startsWith(`${path}\\`)) ? null : current);
			}} selectedPath={selectedFile?.path ?? null} />;
	const viewer = <WorkspaceViewer key={selectedFile?.path} file={selectedFile} entries={files} onFileSelect={setSelectedFile} />;
	if (settings) {
		return (
			<Group orientation="horizontal" className="h-full min-h-0 bg-background" aria-label={t('settings.workspace.title', 'Workspace')}>
				<Panel id="workspace-files" defaultSize="20%" minSize="10%" maxSize="60%" className="flex min-w-0 flex-col">
					<div className="min-h-0 flex-1">{sidebar}</div>
				</Panel>
				<Separator aria-label={t('settings.workspace.resize', 'Resize workspace files')} className="relative w-px shrink-0 bg-border outline-none after:absolute after:inset-y-0 after:-left-1 after:w-2 hover:bg-ring focus-visible:bg-ring" />
				<Panel id="workspace-viewer" minSize="40%" className="flex min-w-0 flex-col">
					{viewer}
				</Panel>
			</Group>
		);
	}
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={sidebar} sidebarLabel="Workspace files">
				{viewer}
			</Split>
		</PageContainer>
	);
}
