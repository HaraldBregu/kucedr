import { useEffect, useState } from 'react';
import { Code2, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CodingProject } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { WorkspaceRow } from './Workspace';

interface CodeSidebarProps {
	readonly title: string;
}

export function CodeSidebar({ title }: CodeSidebarProps): React.JSX.Element {
	const { t } = useTranslation();
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
		localStorage.setItem('coder-workspace', id);
	};
	const add = async (): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			const workspace = await window.coder.addProject();
			if (workspace) { select(workspace.id); setRevision((value) => value + 1); }
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('code.addError', 'Unable to add workspace.'));
		} finally { setBusy(false); }
	};
	return (
		<div data-slot="code-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
				<Code2 className="size-4 shrink-0" strokeWidth={1.8} />
				<h1 className="truncate text-sm font-medium">{title}</h1>
			</header>
			<div className="flex items-center justify-between px-3 py-2">
				<h2 className="text-xs font-medium text-muted-foreground">{t('code.workspaces', 'Workspaces')}</h2>
				<Button variant="ghost" size="icon-xs" disabled={busy} onClick={() => void add()} aria-label={t('code.addWorkspace', 'Add workspace')}><Plus /></Button>
			</div>
			{error && <div className="px-3 pb-2"><p role="alert" className="text-xs text-destructive">{error}</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}><RefreshCw />{t('code.retry', 'Retry')}</Button></div>}
			<nav aria-label={t('code.workspaces', 'Workspaces')} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
				{loading ? <p className="px-2 text-xs text-muted-foreground">{t('code.loading', 'Loading workspaces…')}</p> : workspaces.length === 0 && !error ? <p className="px-2 text-xs text-muted-foreground">{t('code.empty', 'Add a folder to start a workspace.')}</p> : workspaces.map((workspace) => <WorkspaceRow key={workspace.id} workspace={workspace} selected={selected === workspace.id} onSelect={() => select(workspace.id)} onRemove={() => {
					if (selected === workspace.id) { setSelected(null); localStorage.removeItem('coder-workspace'); }
					setRevision((value) => value + 1);
				}} />)}
			</nav>
		</div>
	);
}
