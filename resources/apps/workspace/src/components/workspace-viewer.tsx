import { FileWarning, FileText, LoaderCircle, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkspaceFileKind, WorkspaceTreeEntry } from '@kucedr/sdk';
import type { WorkspaceSettings } from '@/lib/settings';

import { FileViewer, type FileFindControls } from '@/components/viewer';
import { WorkspaceBreadcrumb } from '@/components/breadcrumb';
import { Find } from '@/components/find';
import { FileInformation } from '@/components/information';
import { FormatToggle } from '@/components/format-toggle';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { showNativeContextMenu } from '@/lib/menu';
import { cn } from '@/lib/utils';
import { isUnreadableBinaryError } from '@/lib/binary';
import { countMatches } from '@/lib/matches';

const editableWorkspaceKinds = new Set<WorkspaceFileKind>([
	'markdown',
	'mermaid',
	'excalidraw',
	'tldraw',
	'text',
]);

interface WorkspaceViewerProps {
	content: string;
	dirty: boolean;
	error: string;
	file: WorkspaceTreeEntry | null;
	workspaceFiles: WorkspaceTreeEntry[];
	isDark: boolean;
	kind: WorkspaceFileKind | null;
	loading: boolean;
	mediaUrl: string;
	markdownMode: 'source' | 'preview';
	onChange: (content: string) => void;
	onFileSelect: (entry: WorkspaceTreeEntry) => void;
	onMarkdownModeChange: (mode: 'source' | 'preview') => void;
	onRename: () => void;
	onSave: () => Promise<boolean>;
	findRequest: number;
	path: string | null;
	saving: boolean;
	settings: WorkspaceSettings;
}

export function WorkspaceViewer({
	content,
	dirty,
	error,
	file,
	workspaceFiles,
	isDark,
	kind,
	loading,
	mediaUrl,
	markdownMode,
	onChange,
	onFileSelect,
	onMarkdownModeChange,
	onRename,
	onSave,
	findRequest,
	path,
	saving,
	settings,
}: WorkspaceViewerProps) {
	const editable = kind !== null && editableWorkspaceKinds.has(kind);
	const canvas = kind === 'mermaid' || kind === 'excalidraw' || kind === 'tldraw';
	const [fileFindControls, setFileFindControls] = useState<FileFindControls | null>(null);
	const [findOpen, setFindOpen] = useState(false);
	const [findQuery, setFindQuery] = useState('');
	const searchable = kind === 'text' || (kind === 'markdown' && markdownMode === 'source');
	const findMatchCount = useMemo(() => countMatches(content, findQuery), [content, findQuery]);
	const onFindReady = useCallback((controls: FileFindControls | null) => {
		setFileFindControls(controls);
	}, []);
	const clearFind = useCallback(() => {
		setFindOpen(false);
		setFindQuery('');
		fileFindControls?.clear();
	}, [fileFindControls]);
	const openFind = useCallback(() => {
		setFindOpen(true);
	}, []);
	const updateFindQuery = useCallback(
		(query: string) => {
			setFindQuery(query);
			if (query) fileFindControls?.find(query, 'next');
			else fileFindControls?.clear();
		},
		[fileFindControls]
	);

	useEffect(() => {
		clearFind();
	}, [clearFind, path]);

	useEffect(() => {
		if (findRequest > 0 && searchable) setFindOpen(true);
	}, [findRequest, searchable]);

	useEffect(() => {
		if (!editable) return;
		const saveShortcut = (event: KeyboardEvent) => {
			if (event.defaultPrevented || !(event.metaKey || event.ctrlKey)) return;
			if (event.key.toLowerCase() !== 's') return;
			event.preventDefault();
			void onSave();
		};
		window.addEventListener('keydown', saveShortcut);
		return () => window.removeEventListener('keydown', saveShortcut);
	}, [editable, onSave]);

	if (!path || !kind) {
		return (
			<section
				className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
				aria-label="Workspace file"
			>
				<div className="flex flex-1 items-center justify-center px-6 text-center">
					<div>
						<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<FileText className="h-4 w-4" />
						</div>
						<h2 className="text-sm font-semibold">No file selected</h2>
						<p className="mx-auto mt-1.5 max-w-64 text-xs leading-5 text-muted-foreground">
							Choose a workspace file to view or edit it here.
						</p>
					</div>
				</div>
			</section>
		);
	}
	return (
		<Tabs value={kind === 'markdown' ? markdownMode : undefined} asChild>
			<section
				className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
				aria-label="Workspace file"
				onContextMenu={(event) => {
					showNativeContextMenu(
						event,
						[
							...(kind === 'markdown'
								? [
										{
											id: markdownMode === 'source' ? 'show-preview' : 'show-source',
											label: markdownMode === 'source' ? 'Show Preview' : 'Show Source',
										} as const,
										{ type: 'separator' } as const,
									]
								: []),
							...(editable
								? [
										{
											id: 'save',
											label: 'Save',
											accelerator: 'CommandOrControl+S',
											enabled: dirty && !saving,
										} as const,
										{ type: 'separator' } as const,
									]
								: []),
							{ id: 'rename', label: 'Rename File' },
							{ type: 'separator' },
							{ id: 'copy-path', label: 'Copy Path' },
						],
						{
							save: async () => {
								await onSave();
							},
							'show-preview': () => onMarkdownModeChange('preview'),
							'show-source': () => onMarkdownModeChange('source'),
							rename: onRename,
							'copy-path': () => navigator.clipboard.writeText(path),
						}
					);
				}}
			>
				<header
					aria-label="File navigation"
					className="sticky top-0 z-20 flex h-11 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4"
				>
					<WorkspaceBreadcrumb
						entries={workspaceFiles}
						onFileSelect={onFileSelect}
						path={path}
					/>
					{searchable ? (
						findOpen ? (
							<Find
								autoFocus
								className="ml-auto w-full max-w-md"
								matchCount={findMatchCount}
								onClose={clearFind}
								onNext={() => fileFindControls?.find(findQuery, 'next')}
								onPrevious={() => fileFindControls?.find(findQuery, 'previous')}
								onQueryChange={updateFindQuery}
								query={findQuery}
							/>
						) : (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="ml-auto size-7"
								aria-label="Find in file"
								onClick={openFind}
							>
								<Search />
							</Button>
						)
					) : null}
				</header>
				<div
					className={cn(
						'min-h-0 flex-1',
						canvas ? 'overflow-hidden' : 'overflow-y-auto scrollbar-subtle'
					)}
				>
					{loading ? (
						<div className="flex min-h-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
							<LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading file...
						</div>
					) : error ? (
						<div className="flex min-h-full items-center justify-center px-6 text-center">
							{isUnreadableBinaryError(error) ? (
								<FileWarning
									className="size-5 text-muted-foreground"
									aria-label="File cannot be previewed"
								/>
							) : (
								<p className="max-w-md text-xs text-destructive">{error}</p>
							)}
						</div>
					) : (
						<FileViewer
							canSave={dirty && !saving}
							content={content}
							isDark={isDark}
							kind={kind}
							onChange={onChange}
							onSave={onSave}
							path={path}
							url={mediaUrl}
							settings={settings}
							onFindReady={onFindReady}
						/>
					)}
				</div>

				<footer
					aria-label="File information"
					className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/20 px-2 py-1 sm:px-3"
				>
					<FileInformation file={file} />
					{kind === 'markdown' && !loading ? (
						<div className="ml-auto">
							<FormatToggle
								formatted={markdownMode === 'preview'}
								onFormattedChange={(formatted) =>
									onMarkdownModeChange(formatted ? 'preview' : 'source')
								}
							/>
						</div>
					) : null}
				</footer>
			</section>
		</Tabs>
	);
}
