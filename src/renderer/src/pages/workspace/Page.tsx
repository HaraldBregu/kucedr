import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SettingsPageHeader, SettingsPageShell } from '@/pages/settings/components';
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
			<div className="flex h-full min-h-0 flex-col">
				<div className={selectedFile ? 'hidden' : 'min-h-0 flex-1 overflow-y-auto'}>
					<SettingsPageShell>
						<SettingsPageHeader title={t('settings.workspace.title', 'Workspace')} />
						{sidebar}
					</SettingsPageShell>
				</div>
				{selectedFile ? (
					<>
						<div className="shrink-0 border-b px-3 py-2">
							<Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
								<ArrowLeft className="size-4" />
								{t('settings.workspace.back', 'Back to Workspace')}
							</Button>
						</div>
						{viewer}
					</>
				) : null}
			</div>
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
