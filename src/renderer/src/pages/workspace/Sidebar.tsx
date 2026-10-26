import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FilePlus, FolderPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import type { ContextMenuDescriptor } from '@shared/window_types';
import { workspaceFileType } from '@shared/workspace';
import { AppSidebarFooter } from '@/components/app/SidebarFooter';
import { Button } from '@/components/ui/button';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkspaceActionDialog, type WorkspaceAction } from './ActionDialog';
import { WorkspaceTree } from './Tree';

interface WorkspaceSidebarProps {
	readonly onFileSelect: (file: WorkspaceTreeEntry) => void;
	readonly onFilesLoaded?: (files: WorkspaceTreeEntry[]) => void;
	readonly onEntryRenamed: (sourcePath: string, nextPath: string) => void;
	readonly onEntryDeleted: (path: string) => void;
	readonly selectedPath: string | null;
	readonly beforeEntryChange?: () => Promise<void>;
}

export function WorkspaceSidebar({ onFileSelect, onFilesLoaded, onEntryRenamed, onEntryDeleted, selectedPath, beforeEntryChange = () => Promise.resolve() }: WorkspaceSidebarProps): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [entries, setEntries] = useState<WorkspaceTreeEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [actionError, setActionError] = useState('');
	const [pendingAction, setPendingAction] = useState<WorkspaceAction | null>(null);
	const [renamingEntry, setRenamingEntry] = useState<WorkspaceTreeEntry | null>(null);
	const [busy, setBusy] = useState(false);
	const renameSubmitting = useRef(false);
	const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
	const anchorPath = useRef<string | null>(null);
	const navRef = useRef<HTMLElement>(null);
	const flatten = (list: WorkspaceTreeEntry[]): WorkspaceTreeEntry[] => list.flatMap((item) => [item, ...flatten(item.children ?? [])]);
	const topLevel = (paths: Iterable<string>): string[] => {
		const list = [...paths];
		return list.filter((item) => !list.some((other) => item.startsWith(`${other}/`) || item.startsWith(`${other}\\`)));
	};
	const visibleItems = (): HTMLElement[] => Array.from(navRef.current?.querySelectorAll<HTMLElement>('[data-path]') ?? [])
		.filter((item) => !item.closest('li')?.parentElement?.closest('details:not([open])'));
	const selectRange = (path: string, extend: boolean): void => {
		const paths = visibleItems().map((item) => item.dataset.path ?? '');
		const from = paths.indexOf(anchorPath.current ?? path);
		const to = paths.indexOf(path);
		const range = paths.slice(Math.min(from, to), Math.max(from, to) + 1);
		setSelection((current) => new Set(extend ? [...current, ...range] : range));
	};
	const selectEntry = (entry: WorkspaceTreeEntry, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }): boolean => {
		if (event.shiftKey && anchorPath.current) {
			selectRange(entry.path, event.metaKey || event.ctrlKey);
			return false;
		}
		anchorPath.current = entry.path;
		if (event.metaKey || event.ctrlKey) {
			setSelection((current) => {
				const next = new Set(current);
				if (!next.delete(entry.path)) next.add(entry.path);
				return next;
			});
			return false;
		}
		setSelection(new Set([entry.path]));
		return true;
	};
	const deleteSelection = (targets: WorkspaceTreeEntry[]): void => {
		if (targets.length === 0 || busy) return;
		const message = targets.length > 1
			? t('workspaceSidebar.deleteEntries', { count: targets.length, defaultValue: 'Delete {{count}} items' })
			: t('workspaceSidebar.deleteEntry', { name: targets[0].name });
		if (!window.confirm(`${message}\n\n${t('workspaceSidebar.deleteWarning', 'This permanently deletes the item and its contents.')}`)) return;
		setBusy(true);
		setActionError('');
		void (async () => {
			for (const target of targets) {
				if (target.type === 'directory') await window.agent.deleteWorkspaceDirectory(target.path);
				else await window.agent.deleteWorkspaceFile(target.path);
				onEntryDeleted(target.path);
			}
			setSelection(new Set());
			const files = await window.agent.listWorkspaceFiles();
			setEntries(files);
			onFilesLoaded?.(files);
		})().catch((cause: unknown) => {
			setActionError(cause instanceof Error ? cause.message : t('workspaceSidebar.actionError', 'Unable to change Workspace files.'));
		}).finally(() => setBusy(false));
	};
	const handleTreeKey = (event: React.KeyboardEvent<HTMLElement>): void => {
		const target = event.target as HTMLElement;
		const path = target.dataset.path;
		if (path === undefined) return;
		const items = visibleItems();
		const index = items.indexOf(target);
		const mod = event.metaKey || event.ctrlKey;
		const focusItem = (next: HTMLElement | undefined): void => {
			const nextPath = next?.dataset.path;
			if (!next || nextPath === undefined) return;
			next.focus();
			if (event.shiftKey) selectRange(nextPath, false);
			else {
				anchorPath.current = nextPath;
				setSelection(new Set([nextPath]));
			}
		};
		const details = target.tagName === 'SUMMARY' ? target.parentElement as HTMLDetailsElement : null;
		if (event.key === 'ArrowDown') focusItem(items[index + 1]);
		else if (event.key === 'ArrowUp') focusItem(items[index - 1]);
		else if (event.key === 'Home') focusItem(items[0]);
		else if (event.key === 'End') focusItem(items[items.length - 1]);
		else if (event.key === 'ArrowRight' && details) details.open = true;
		else if (event.key === 'ArrowLeft' && details?.open) details.open = false;
		else if (event.key === 'ArrowLeft') focusItem(target.closest('li')?.parentElement?.closest('details')?.querySelector<HTMLElement>(':scope > summary') ?? undefined);
		else if (event.key === 'a' && mod) setSelection(new Set(items.map((item) => item.dataset.path ?? '')));
		else if (event.key === 'Escape') setSelection(new Set());
		else if (event.key === 'F2') setRenamingEntry(flatten(entries).find((item) => item.path === path) ?? null);
		else if (event.key === 'Delete' || (event.key === 'Backspace' && mod)) {
			const paths = topLevel(selection.has(path) ? selection : [path]);
			deleteSelection(flatten(entries).filter((item) => paths.includes(item.path)));
		}
		else return;
		event.preventDefault();
	};

	useEffect(() => {
		let active = true;
		let refreshTimer: number | undefined;
		const load = (): void => {
			void window.agent.listWorkspaceFiles()
				.then((files) => {
					if (!active) return;
					setEntries(files);
					onFilesLoaded?.(files);
					setError(false);
				})
				.catch(() => {
					if (active) setError(true);
				})
				.finally(() => {
					if (active) setLoading(false);
				});
		};
		const unsubscribe = window.agent.onWorkspaceChanged((event) => {
			if (event.type === 'change') return;
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(load, 100);
		});
		load();
		return () => {
			active = false;
			window.clearTimeout(refreshTimer);
			unsubscribe();
		};
	}, [onFilesLoaded]);

	const showEntryMenu = (entry?: WorkspaceTreeEntry): void => {
		const multiple = entry && selection.size > 1 && selection.has(entry.path);
		if (entry && !selection.has(entry.path)) {
			anchorPath.current = entry.path;
			setSelection(new Set([entry.path]));
		}
		const parentPath = entry?.type === 'directory' ? entry.path : entry?.path.split(/[\\/]/).slice(0, -1).join('/') ?? '';
		const revealLabel = navigator.platform.startsWith('Mac')
			? t('workspaceSidebar.revealInFinder', 'Reveal in Finder')
			: t('workspaceSidebar.revealInFileManager', 'Show in file manager');
		const items: ContextMenuDescriptor[] = [
			{ id: 'create-file', label: t('workspaceSidebar.newFile', 'New file') },
			{ id: 'create-folder', label: t('workspaceSidebar.newFolder', 'New folder') },
			...(multiple ? [
				{ type: 'separator' as const },
				{ id: 'delete', label: t('workspaceSidebar.deleteCount', { count: topLevel(selection).length, defaultValue: 'Delete {{count}} items' }) },
			] : entry ? [
				{ type: 'separator' as const },
				{ id: 'reveal', label: revealLabel },
				...(entry.type === 'file' && workspaceFileType(entry.path).kind === 'markdown' ? [{ id: 'clean-assets', label: t('workspaceSidebar.cleanAssets', 'Move unused assets to Trash') }] : []),
				{ id: 'rename', label: t('workspaceSidebar.rename', 'Rename') },
				{ id: 'delete', label: t('workspaceSidebar.delete', 'Delete') },
			] : []),
		];
		setActionError('');
		void window.win.showContextMenu(items).then(async (kind): Promise<void> => {
			if (kind === 'reveal' && entry) await window.agent.revealWorkspaceEntry(entry.path);
			else if (kind === 'clean-assets' && entry) {
				await window.agent.cleanWorkspaceAssets(entry.path);
				const files = await window.agent.listWorkspaceFiles();
				setEntries(files);
				onFilesLoaded?.(files);
			}
			else if (kind === 'rename' && entry) setRenamingEntry(entry);
			else if (kind === 'delete' && multiple) {
				const paths = topLevel(selection);
				deleteSelection(flatten(entries).filter((item) => paths.includes(item.path)));
			}
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
		void beforeEntryChange().then(() => window.agent.renameWorkspaceEntry(entry.path, name))
			.then(async (nextPath) => {
				onEntryRenamed(entry.path, nextPath);
				setRenamingEntry(null);
				const files = await window.agent.listWorkspaceFiles();
				setEntries(files);
				onFilesLoaded?.(files);
			})
			.catch((cause: unknown) => {
				setActionError(cause instanceof Error ? cause.message : t('workspaceSidebar.actionError', 'Unable to change Workspace files.'));
			})
			.finally(() => {
				renameSubmitting.current = false;
				setBusy(false);
			});
	};

	const moveEntries = (sourcePaths: string[], destinationPath: string): void => {
		const sources = topLevel(sourcePaths.filter((sourcePath) => sourcePath !== destinationPath));
		if (busy || sources.length === 0) return;
		setBusy(true);
		setActionError('');
		const moved: string[] = [];
		void beforeEntryChange()
			.then(async () => {
				for (const sourcePath of sources) {
					const nextPath = await window.agent.moveWorkspaceEntry(sourcePath, destinationPath);
					if (nextPath !== sourcePath) onEntryRenamed(sourcePath, nextPath);
					moved.push(nextPath);
				}
			})
			.finally(() => setSelection(new Set(moved)))
			.then(async () => {
				const files = await window.agent.listWorkspaceFiles();
				setEntries(files);
				onFilesLoaded?.(files);
			})
			.catch((cause: unknown) => {
				setActionError(cause instanceof Error ? cause.message : t('workspaceSidebar.actionError', 'Unable to change Workspace files.'));
			})
			.finally(() => setBusy(false));
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
				for (const target of pendingAction.entries ?? [entry]) {
					if (target.type === 'directory') await window.agent.deleteWorkspaceDirectory(target.path);
					else await window.agent.deleteWorkspaceFile(target.path);
					onEntryDeleted(target.path);
				}
				setSelection(new Set());
			}
			setPendingAction(null);
			const files = await window.agent.listWorkspaceFiles();
			setEntries(files);
			onFilesLoaded?.(files);
		})().catch((cause: unknown) => {
			setActionError(cause instanceof Error ? cause.message : t('workspaceSidebar.actionError', 'Unable to change Workspace files.'));
		}).finally(() => setBusy(false));
	};

	return (
		<div data-slot="workspace-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 border-b border-sidebar-border/50 p-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton type="button" className="px-2.5 text-sm" onClick={() => navigate('/home')}>
							<ArrowLeft className="size-4 shrink-0" />
							<span className="truncate">{t('settings.returnToChat', 'Return to Home')}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</header>
			<div className="flex shrink-0 items-center gap-1 px-4 pb-1 pt-3">
				<span className="flex-1 text-xs font-medium text-muted-foreground">{t('workspaceSidebar.files', 'Workspace files')}</span>
				{([
					{ kind: 'create-file', label: t('workspaceSidebar.newFile', 'New file'), icon: FilePlus },
					{ kind: 'create-folder', label: t('workspaceSidebar.newFolder', 'New folder'), icon: FolderPlus },
				] as const).map(({ kind, label, icon: Icon }) => (
					<Tooltip key={kind}>
						<TooltipTrigger render={
							<Button type="button" variant="ghost" size="icon-xs" aria-label={label} className="text-muted-foreground" onClick={() => {
								setActionError('');
								setPendingAction({ kind, parentPath: '' });
							}}>
								<Icon />
							</Button>
						} />
						<TooltipContent side="bottom">{label}</TooltipContent>
					</Tooltip>
				))}
			</div>
			<nav ref={navRef} onKeyDown={handleTreeKey} aria-label={t('workspaceSidebar.files', 'Workspace files')} className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2" onContextMenu={(event) => {
				event.preventDefault();
				showEntryMenu();
			}} onDragOver={(event) => {
				if (event.dataTransfer.types.includes('application/x-workspace-path')) event.preventDefault();
			}} onDrop={(event) => {
				const source = event.dataTransfer.getData('application/x-workspace-path');
				if (!source) return;
				event.preventDefault();
				moveEntries(source.split('\n'), '');
			}}>
				{actionError && !pendingAction ? <p className="px-2 py-1 text-xs text-destructive" role="alert">{actionError}</p> : null}
				{loading ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">{t('workspaceSidebar.loading', 'Loading files…')}</p>
				) : error ? (
					<p className="px-2 py-1 text-xs text-destructive" role="alert">{t('workspaceSidebar.error', 'Unable to load Workspace files.')}</p>
				) : entries.length === 0 ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">{t('workspaceSidebar.empty', 'Workspace is empty.')}</p>
				) : (
					<WorkspaceTree entries={entries} onFileSelect={onFileSelect} onEntryContextMenu={showEntryMenu} renamingPath={renamingEntry?.path ?? null} renameBusy={busy} onRename={confirmRename} onRenameCancel={() => { setRenamingEntry(null); setActionError(''); }} selectedPath={selectedPath} selection={selection} onSelect={selectEntry} onMove={moveEntries} />
				)}
			</nav>
			{pendingAction ? <WorkspaceActionDialog key={`${pendingAction.kind}:${pendingAction.entry?.path ?? pendingAction.parentPath}`} action={pendingAction} busy={busy} error={actionError} onClose={() => { setPendingAction(null); setActionError(''); }} onConfirm={confirmAction} /> : null}
			<AppSidebarFooter />
		</div>
	);
}
