import { FileText, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import type { WorkspaceFileKind, WorkspaceTreeEntry } from '@kucedr/sdk';
import type { WorkspaceSettings } from '@/lib/settings';

import { FileViewer } from '@/components/viewer';
import { FileInformation } from '@/components/information';
import { FormatToggle } from '@/components/format-toggle';
import { Tabs } from '@/components/ui/tabs';
import { showNativeContextMenu } from '@/lib/menu';
import { cn } from '@/lib/utils';

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
	isDark: boolean;
	kind: WorkspaceFileKind | null;
	loading: boolean;
	mediaUrl: string;
	markdownMode: 'source' | 'preview';
	onChange: (content: string) => void;
	onMarkdownModeChange: (mode: 'source' | 'preview') => void;
	onRename: () => void;
	onSave: () => Promise<boolean>;
	path: string | null;
	saving: boolean;
	settings: WorkspaceSettings;
}

export function WorkspaceViewer({
	content,
	dirty,
	error,
	file,
	isDark,
	kind,
	loading,
	mediaUrl,
	markdownMode,
	onChange,
	onMarkdownModeChange,
	onRename,
	onSave,
	path,
	saving,
	settings,
}: WorkspaceViewerProps) {
	const editable = kind !== null && editableWorkspaceKinds.has(kind);
	const canvas = kind === 'mermaid' || kind === 'excalidraw' || kind === 'tldraw';

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
							<p className="max-w-md text-xs text-destructive">{error}</p>
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
