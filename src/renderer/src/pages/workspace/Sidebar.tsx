import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import type { ContextMenuDescriptor } from '@shared/window_types';
import { SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { AppSidebarFooter } from '@/components/app/SidebarFooter';
import { WorkspaceActionDialog, type WorkspaceAction } from './ActionDialog';
import { WorkspaceTree } from './Tree';

interface WorkspaceSidebarProps {
	readonly onFileSelect: (file: WorkspaceTreeEntry) => void;
	readonly onEntryRenamed: (sourcePath: string, nextPath: string) => void;
	readonly onEntryDeleted: (path: string) => void;
	readonly selectedPath: string | null;
}

export function WorkspaceSidebar({ onFileSelect, onEntryRenamed, onEntryDeleted, selectedPath }: WorkspaceSidebarProps): React.JSX.Element {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<WorkspaceTreeEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [actionError, setActionError] = useState('');
	const [pendingAction, setPendingAction] = useState<WorkspaceAction | null>(null);
	const [renamingEntry, setRenamingEntry] = useState<WorkspaceTreeEntry | null>(null);
	const [busy, setBusy] = useState(false);
	const renameSubmitting = useRef(false);

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

	const showEntryMenu = (entry?: WorkspaceTreeEntry): void => {
		const parentPath = entry?.type === 'directory' ? entry.path : entry?.path.split(/[\\/]/).slice(0, -1).join('/') ?? '';
		const revealLabel = navigator.platform.startsWith('Mac')
			? t('workspaceSidebar.revealInFinder', 'Reveal in Finder')
			: t('workspaceSidebar.revealInFileManager', 'Show in file manager');
		const items: ContextMenuDescriptor[] = [
			{ id: 'create-file', label: t('workspaceSidebar.newFile', 'New file') },
			{ id: 'create-folder', label: t('workspaceSidebar.newFolder', 'New folder') },
			...(entry ? [
				{ type: 'separator' as const },
				{ id: 'reveal', label: revealLabel },
				{ id: 'rename', label: t('workspaceSidebar.rename', 'Rename') },
				{ id: 'delete', label: t('workspaceSidebar.delete', 'Delete') },
			] : []),
		];
		setActionError('');
		void window.win.showContextMenu(items).then(async (kind): Promise<void> => {
			if (kind === 'reveal' && entry) await window.agent.revealWorkspaceEntry(entry.path);
			else if (kind === 'rename' && entry) setRenamingEntry(entry);
			else if (kind === 'create-file' || kind === 'create-folder' || (kind === 'delete' && entry)) {
				setPendingAction({ kind, entry, parentPath });
			}
		}).catch((cause: unknown) => {
			setActionError(cause instanceof Error ? cause.message : t('workspaceSidebar.actionError', 'Unable to change Workspace files.'));
		});
	};

	const confirmRename = (name: string): void => {
		const entry = renamingEntry;
		if (!entry || renameSubmitting.current) return;
		if (!name) {
			setActionError(t('workspaceSidebar.namePrompt', 'Enter a name for the item.'));
			return;
		}
		if (name === entry.name) {
			setRenamingEntry(null);
			return;
		}
		renameSubmitting.current = true;
		setBusy(true);
		setActionError('');
		void window.agent.renameWorkspaceEntry(entry.path, name)
			.then(async (nextPath) => {
				onEntryRenamed(entry.path, nextPath);
				setRenamingEntry(null);
				setEntries(await window.agent.listWorkspaceFiles());
			})
			.catch((cause: unknown) => {
				setActionError(cause instanceof Error ? cause.message : t('workspaceSidebar.actionError', 'Unable to change Workspace files.'));
			})
			.finally(() => {
				renameSubmitting.current = false;
				setBusy(false);
			});
	};

	const confirmAction = (name: string): void => {
		if (!pendingAction || busy) return;
		setBusy(true);
		setActionError('');
		void (async () => {
			const { kind, entry, parentPath } = pendingAction;
			if (kind === 'create-file') {
				const path = await window.agent.createWorkspaceFile(parentPath, name);
				onFileSelect({ type: 'file', name, path });
			} else if (kind === 'create-folder') {
				await window.agent.createWorkspaceDirectory(parentPath, name);
			} else if (kind === 'delete' && entry) {
				if (entry.type === 'directory') await window.agent.deleteWorkspaceDirectory(entry.path);
				else await window.agent.deleteWorkspaceFile(entry.path);
				onEntryDeleted(entry.path);
			}
			setPendingAction(null);
			setEntries(await window.agent.listWorkspaceFiles());
		})().catch((cause: unknown) => {
			setActionError(cause instanceof Error ? cause.message : t('workspaceSidebar.actionError', 'Unable to change Workspace files.'));
		}).finally(() => setBusy(false));
	};

	return (
		<div data-slot="workspace-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 border-b border-sidebar-border/50 p-2">
				<Link to="/home" className={SPLIT_ITEM_CLASS}>
					<ArrowLeft className="size-4 shrink-0" strokeWidth={1.8} />
					<span>{t('navigationBar.chat', 'Chat')}</span>
				</Link>
			</header>
			<nav aria-label={t('workspaceSidebar.files', 'Workspace files')} className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2" onContextMenu={(event) => {
				event.preventDefault();
				showEntryMenu();
			}}>
				<h1 className="px-2 py-2 text-xs font-medium text-sidebar-foreground/70">
					{t('navigationBar.workspace', 'Workspace')}
				</h1>
				{actionError && !pendingAction ? <p className="px-2 py-1 text-xs text-destructive" role="alert">{actionError}</p> : null}
				{loading ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">{t('workspaceSidebar.loading', 'Loading files…')}</p>
				) : error ? (
					<p className="px-2 py-1 text-xs text-destructive" role="alert">{t('workspaceSidebar.error', 'Unable to load Workspace files.')}</p>
				) : entries.length === 0 ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">{t('workspaceSidebar.empty', 'Workspace is empty.')}</p>
				) : (
					<WorkspaceTree entries={entries} onFileSelect={onFileSelect} onEntryContextMenu={showEntryMenu} renamingPath={renamingEntry?.path ?? null} renameBusy={busy} onRename={confirmRename} onRenameCancel={() => { setRenamingEntry(null); setActionError(''); }} selectedPath={selectedPath} />
				)}
			</nav>
			{pendingAction ? <WorkspaceActionDialog key={`${pendingAction.kind}:${pendingAction.entry?.path ?? pendingAction.parentPath}`} action={pendingAction} busy={busy} error={actionError} onClose={() => { setPendingAction(null); setActionError(''); }} onConfirm={confirmAction} /> : null}
			<AppSidebarFooter />
		</div>
	);
}
