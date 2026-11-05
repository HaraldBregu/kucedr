import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatFileSize } from '@/pages/home/attachments/size';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import type { WorkspaceTextSize } from '@shared/app_types';
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
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [wide, setWide] = useState(false);
	const [textSize, setTextSize] = useState<WorkspaceTextSize>('medium');
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
	useEffect(() => {
		void window.app.getWorkspaceTextSize().then(setTextSize);
	}, []);
	const handleTextSizeChange = useCallback((next: WorkspaceTextSize) => {
		setTextSize(next);
		void window.app.setWorkspaceTextSize(next);
	}, []);
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
	const details = (
		detailsOpen ? <aside aria-label="Workspace details" className="absolute inset-y-0 right-0 z-20 flex w-72 max-w-full flex-col overflow-auto border-l bg-background shadow-lg sm:relative sm:shrink-0 sm:shadow-none">
			<div className="flex items-center justify-between border-b px-4 py-2"><h2 className="text-sm font-semibold">File details</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Close file details" onClick={() => setDetailsOpen(false)}><X /></Button></div>
			{selectedFile ? <div className="space-y-5 p-4 text-sm">
				<div className="space-y-2"><h3 className="font-medium">Details</h3><dl className="space-y-2 text-muted-foreground"><div><dt className="text-xs">Name</dt><dd className="break-all text-foreground">{selectedFile.name}</dd></div><div><dt className="text-xs">Path</dt><dd className="break-all text-foreground">{selectedFile.path}</dd></div>{typeof selectedFile.size === 'number' ? <div><dt className="text-xs">Size</dt><dd className="text-foreground">{formatFileSize(selectedFile.size)}</dd></div> : null}{selectedFile.createdAt ? <div><dt className="text-xs">Created</dt><dd className="text-foreground">{new Date(selectedFile.createdAt).toLocaleString()}</dd></div> : null}{selectedFile.updatedAt ? <div><dt className="text-xs">Updated</dt><dd className="text-foreground">{new Date(selectedFile.updatedAt).toLocaleString()}</dd></div> : null}</dl></div>
				<div className="space-y-3 border-t pt-4"><h3 className="font-medium">Styles</h3><label className="block space-y-1 text-xs text-muted-foreground"><span>Text size</span><Select value={textSize} onValueChange={(value) => { if (value) handleTextSizeChange(value); }}><SelectTrigger aria-label="Sidebar text size" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(['extra-small', 'small', 'medium', 'large', 'extra-large'] as const).map((size) => <SelectItem key={size} value={size}>{size === 'medium' ? 'Medium (default)' : size.replace('-', ' ')}</SelectItem>)}</SelectContent></Select></label><Button type="button" variant="outline" size="sm" className="w-full justify-start" aria-pressed={wide} onClick={() => handleWideChange(!wide)}>Full width {wide ? 'on' : 'off'}</Button></div>
			</div> : <p className="p-4 text-sm text-muted-foreground">Choose a file to see its details and options.</p>}
		</aside> : null
	);
	const viewer = <WorkspaceViewer details={details} ref={flushRef} key={path} file={selectedFile} onFileSelect={selectFile} wide={wide} onWideChange={handleWideChange} textSize={textSize} onTextSizeChange={handleTextSizeChange} />;
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split navigationActions={<Button type="button" variant="ghost" size="icon-sm" aria-label="File details" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}><PanelRight /></Button>} sidebar={sidebar} sidebarLabel="Workspace files" navigationContent={selectedFile ? <WorkspaceBreadcrumb entries={files} path={selectedFile.path} onFileSelect={selectFile} /> : undefined}>
				{viewer}

			</Split>
		</PageContainer>
	);
}
