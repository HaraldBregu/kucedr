import { useEffect, useState } from 'react';
import { Code2, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { WorkspaceSelector } from './Workspace';
import { WorkspaceFiles } from './Files';

interface CodeSidebarProps {
	readonly title: string;
	readonly selectedFile: { projectId: string; fileName: string } | null;
	readonly onSelectWorkspace: () => void;
	readonly onOpenFile: (projectId: string, fileName: string) => void;
}

export function CodeSidebar({ title, selectedFile, onSelectWorkspace, onOpenFile }: CodeSidebarProps): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const [workspaces, setWorkspaces] = useState<CodingProject[]>([]);
	const [selected, setSelected] = useState<string | null>(() => localStorage.getItem('coder-workspace'));
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		let active = true;
		setLoading(true);
		window.coder.listProjects().then((items) => {
			if (active) { setWorkspaces(items); setError(''); }
		}).catch((cause: unknown) => {
			if (active) setError(cause instanceof Error ? cause.message : t('code.loadError', 'Unable to load workspaces.'));
		}).finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [revision, t]);
	const select = (id: string): void => {
		setSelected(id);
		onSelectWorkspace();
		localStorage.setItem('coder-workspace', id);
		navigate('/code');
	};
	const add = async (): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			const workspace = await window.coder.addProject();
			if (workspace) { select(workspace.id); setRevision((value) => value + 1); }
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('code.addError', 'Unable to create workspace.'));
		} finally { setBusy(false); }
	};
	const workspace = workspaces.find((item) => item.id === selected) ?? workspaces[0];
	return (
		<div data-slot="code-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
				<Code2 className="size-4 shrink-0" strokeWidth={1.8} />
				<h1 className="flex-1 truncate text-sm font-medium">{title}</h1>
				<Button variant={location.pathname === '/code/settings' ? 'secondary' : 'ghost'} size="icon-xs" aria-label={t('codeSettings.title', 'Coder settings')} aria-current={location.pathname === '/code/settings' ? 'page' : undefined} onClick={() => navigate('/code/settings')}><Settings2 /></Button>
			</header>
			<div className="flex items-center justify-between px-3 py-2">
				<h2 className="text-xs font-medium text-muted-foreground">{t('code.workspaces', 'Workspaces')}</h2>
				<Button variant="ghost" size="icon-xs" disabled={busy} onClick={() => void add()} aria-label={t('code.addWorkspace', 'New workspace')}><Plus /></Button>
			</div>
			{error && <div className="px-3 pb-2"><p role="alert" className="text-xs text-destructive">{error}</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}><RefreshCw />{t('code.retry', 'Retry')}</Button></div>}
			{!loading && workspace && <div className="px-2 pb-2"><WorkspaceSelector workspace={workspace} workspaces={workspaces} onSelect={select} onRemove={() => {
				setSelected(null);
				localStorage.removeItem('coder-workspace');
				onSelectWorkspace();
				setRevision((value) => value + 1);
			}} /></div>}
			<nav aria-label={t('codeFiles.files', 'Files')} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
				{loading ? <p className="px-2 text-xs text-muted-foreground">{t('code.loading', 'Loading workspaces…')}</p> : !workspace && !error ? <p className="px-2 text-xs text-muted-foreground">{t('code.empty', 'Create a workspace to get started.')}</p> : workspace?.available ? <WorkspaceFiles key={workspace.id} projectId={workspace.id} selectedFile={selectedFile?.projectId === workspace.id && location.pathname === '/code' ? selectedFile.fileName : null} onOpen={(fileName) => onOpenFile(workspace.id, fileName)} /> : null}
			</nav>
		</div>
	);
}
