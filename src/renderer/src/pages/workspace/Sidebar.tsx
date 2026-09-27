import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { WorkspaceTree } from './Tree';

export function WorkspaceSidebar(): React.JSX.Element {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<WorkspaceTreeEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let active = true;
		let refreshTimer: number | undefined;
		const load = (): void => {
			void window.agent.listWorkspaceFiles()
				.then((files) => {
					if (!active) return;
					setEntries(files);
					setError(false);
				})
				.catch(() => {
					if (active) setError(true);
				})
				.finally(() => {
					if (active) setLoading(false);
				});
		};
		const unsubscribe = window.agent.onWorkspaceChanged(() => {
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(load, 100);
		});
		load();
		return () => {
			active = false;
			window.clearTimeout(refreshTimer);
			unsubscribe();
		};
	}, []);

	return (
		<div data-slot="workspace-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 border-b border-sidebar-border/50 p-2">
				<Link to="/home" className={SPLIT_ITEM_CLASS}>
					<ArrowLeft className="size-4 shrink-0" strokeWidth={1.8} />
					<span>{t('navigationBar.chat', 'Chat')}</span>
				</Link>
			</header>
			<nav aria-label={t('workspaceSidebar.files', 'Workspace files')} className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
				<h1 className="px-2 py-2 text-xs font-medium text-sidebar-foreground/70">
					{t('navigationBar.workspace', 'Workspace')}
				</h1>
				{loading ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">{t('workspaceSidebar.loading', 'Loading files…')}</p>
				) : error ? (
					<p className="px-2 py-1 text-xs text-destructive" role="alert">{t('workspaceSidebar.error', 'Unable to load Workspace files.')}</p>
				) : entries.length === 0 ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">{t('workspaceSidebar.empty', 'Workspace is empty.')}</p>
				) : (
					<WorkspaceTree entries={entries} />
				)}
			</nav>
		</div>
	);
}
