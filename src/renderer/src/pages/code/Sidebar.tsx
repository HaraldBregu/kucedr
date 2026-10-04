import { useEffect, useState } from 'react';
import { Code2, FolderPlus, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { WorkspaceSelector } from './Workspace';
import { WorkspaceFiles } from './Files';

interface CodeSidebarProps {
	readonly title: string;
	readonly creation: 'markdown' | 'instructions' | null;
	readonly onCreationChange: (creation: 'markdown' | 'instructions' | null) => void;
	readonly onFileCreationAvailable: (available: boolean) => void;
	readonly refreshKey: number;
	readonly selectedFile: { projectId: string; fileName: string } | null;
	readonly onSelectWorkspace: () => void;
	readonly onOpenFile: (projectId: string, fileName: string) => void;
}

export function CodeSidebar({ title, creation, onCreationChange, onFileCreationAvailable, refreshKey, selectedFile, onSelectWorkspace, onOpenFile }: CodeSidebarProps): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const [workspaces, setWorkspaces] = useState<CodingProject[]>([]);
	const [selected, setSelected] = useState<string | null>(() => localStorage.getItem('coder-workspace'));
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		let active = true;
		setLoading(true);
		window.coder.listProjects().then((items) => {
			if (active) { setWorkspaces(items); setSelected(localStorage.getItem('coder-workspace')); setError(''); }
		}).catch((cause: unknown) => {
			if (active) setError(cause instanceof Error ? cause.message : t('code.loadError', 'Unable to load workspaces.'));
		}).finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [revision, refreshKey, t]);
	const select = (id: string): void => {
		setSelected(id);
		onCreationChange(null);
		onSelectWorkspace();
		localStorage.setItem('coder-workspace', id);
		navigate('/code');
	};
	const workspace = workspaces.find((item) => item.id === selected) ?? workspaces[0];
	useEffect(() => { onFileCreationAvailable(!loading && Boolean(workspace?.available)); }, [loading, workspace?.available, onFileCreationAvailable]);
	return (
		<div data-slot="code-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="flex min-h-12 shrink-0 items-center gap-1 border-b border-sidebar-border px-2 py-2">
				{!loading && workspace ? <WorkspaceSelector workspace={workspace} workspaces={workspaces} onSelect={select} />: <><Code2 className="size-4 shrink-0" strokeWidth={1.8} /><h1 className="flex-1 truncate text-sm font-medium">{title}</h1></>}
			</header>
			{error && <div className="px-3 pb-2"><p role="alert" className="text-xs text-destructive">{error}</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}><RefreshCw />{t('code.retry', 'Retry')}</Button></div>}

			<nav aria-label={t('codeFiles.files', 'Files')} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
				{loading ? <p className="px-2 text-xs text-muted-foreground">{t('code.loading', 'Loading workspaces…')}</p> : !workspace && !error ? <div className="grid justify-items-start gap-3 px-2 py-6">
					<FolderPlus className="size-6 text-muted-foreground" aria-hidden="true" />
					<div className="grid gap-1"><h2 className="text-sm font-medium">{t('codeWorkspace.emptyTitle', 'No workspaces yet')}</h2><p className="text-xs leading-relaxed text-muted-foreground">{t('codeWorkspace.emptyDescription', 'Create a workspace to organize your files, instructions, and sessions.')}</p></div>
					<Button className="h-auto min-h-7 w-full whitespace-normal py-1.5" size="sm" onClick={() => navigate('/code/new')}><Plus /><span>{t('codeWorkspace.create', 'Create workspace')}</span></Button>
				</div> : workspace?.available ? <WorkspaceFiles creation={creation} onCancelCreation={() => onCreationChange(null)} key={workspace.id} projectId={workspace.id} selectedFile={selectedFile?.projectId === workspace.id && location.pathname === '/code' ? selectedFile.fileName : null} onOpen={(fileName) => onOpenFile(workspace.id, fileName)} /> : null}
			</nav>
			<footer className="shrink-0 border-t border-sidebar-border p-2">
				<Button className="w-full justify-start" variant={location.pathname === '/code/settings' ? 'secondary' : 'ghost'} aria-current={location.pathname === '/code/settings' ? 'page' : undefined} onClick={() => navigate('/code/settings')}>
					<Settings2 /><span className="truncate">{t('codeSettings.title', 'Coder settings')}</span>
				</Button>
			</footer>
		</div>
	);
}
