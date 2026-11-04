import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { WorkspaceSidebar } from './Sidebar';
import { WorkspaceViewer } from './Viewer';
import { WorkspaceBreadcrumb } from './Breadcrumb';

const SELECTED_FILE_KEY = 'workspace-selected-file';

export default function WorkspacePage(): React.JSX.Element {
	const location = useLocation();
	const navigate = useNavigate();
	const navigationType = useNavigationType();
	const [files, setFiles] = useState<WorkspaceTreeEntry[]>([]);
	const [wide, setWide] = useState(false);
	const flushRef = useRef<() => Promise<void>>(null);
	const initialized = useRef(false);
	const path = new URLSearchParams(location.search).get('file');
	const pending = [...files];
	let selectedFile: WorkspaceTreeEntry | null = path ? { type: 'file', path, name: path.split(/[\\/]/).pop() ?? path } : null;
	while (pending.length > 0 && path) {
		const entry = pending.pop()!;
		if (entry.path === path && entry.type === 'file') { selectedFile = entry; break; }
		if (entry.children) pending.push(...entry.children);
	}
	const selectFile = useCallback((file: WorkspaceTreeEntry, replace = false) => {
		if (file.path === path) return;
		const search = new URLSearchParams({ file: file.path }).toString();
		navigate({ pathname: '/workspace', search: `?${search}` }, { replace });
	}, [navigate, path]);
	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;
		const saved = localStorage.getItem(SELECTED_FILE_KEY);
		if (!path && saved && (navigationType !== 'POP' || location.key === 'default')) selectFile({ type: 'file', path: saved, name: saved.split(/[\\/]/).pop() ?? saved }, true);
	}, [location.key, navigationType, path, selectFile]);
	useEffect(() => {
		void window.app.getWorkspaceWideContent().then(setWide);
	}, []);
	const handleWideChange = useCallback((next: boolean) => {
		setWide(next);
		void window.app.setWorkspaceWideContent(next);
	}, []);
	useEffect(() => {
		if (path) localStorage.setItem(SELECTED_FILE_KEY, path);
	}, [path]);
	const handleFilesLoaded = useCallback((next: WorkspaceTreeEntry[]) => setFiles(next), []);
	const sidebar = <WorkspaceSidebar onFileSelect={selectFile} onFilesLoaded={handleFilesLoaded} onEntryRenamed={(sourcePath, nextPath) => {
		if (!path) return;
		if (path === sourcePath) selectFile({ type: 'file', path: nextPath, name: nextPath.split(/[\\/]/).pop() ?? nextPath }, true);
		else if (path.startsWith(`${sourcePath}/`) || path.startsWith(`${sourcePath}\\`)) selectFile({ type: 'file', path: `${nextPath}/${path.slice(sourcePath.length + 1)}`, name: selectedFile?.name ?? '' }, true);
	}} onEntryDeleted={(deletedPath) => {
		if (path && (path === deletedPath || path.startsWith(`${deletedPath}/`) || path.startsWith(`${deletedPath}\\`))) {
			localStorage.removeItem(SELECTED_FILE_KEY);
			navigate('/workspace', { replace: true });
		}
	}} selectedPath={path} beforeEntryChange={() => flushRef.current?.() ?? Promise.resolve()} />;
	const viewer = <WorkspaceViewer ref={flushRef} key={path} file={selectedFile} onFileSelect={selectFile} wide={wide} onWideChange={handleWideChange} />;
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={sidebar} sidebarLabel="Workspace files" navigationContent={selectedFile ? <WorkspaceBreadcrumb entries={files} path={selectedFile.path} onFileSelect={selectFile} /> : undefined}>
				{viewer}
			</Split>
		</PageContainer>
	);
}
