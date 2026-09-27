import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { workspaceFileType } from '@shared/workspace';
import { Markdown } from '@/components/prompt-kit/markdown';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsDark } from '@/hooks/use-is-dark';
import { markdownComponents } from '@/pages/home/components/markdown';

const CodeMirrorEditor = lazy(async () => {
	const module = await import('./Editor');
	return { default: module.CodeMirrorEditor };
});

interface WorkspaceViewerProps {
	readonly file: WorkspaceTreeEntry | null;
}

export function WorkspaceViewer({ file }: WorkspaceViewerProps): React.JSX.Element {
	const { t } = useTranslation();
	const isDark = useIsDark();
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [saveError, setSaveError] = useState('');
	const [markdownMode, setMarkdownMode] = useState<'preview' | 'source'>('preview');
	const pendingContent = useRef<string | null>(null);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveQueue = useRef(Promise.resolve());
	const kind = file ? workspaceFileType(file.path).kind : null;
	const media = kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'pdf';
	const mediaUrl = file && media ? new URL('local-resource://agent/') : null;
	if (mediaUrl && file) mediaUrl.pathname = `/${file.path.replaceAll('\\', '/')}`;

	const save = useCallback(() => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = null;
		const nextContent = pendingContent.current;
		pendingContent.current = null;
		if (!file || nextContent === null) return;
		saveQueue.current = saveQueue.current.then(() => window.agent.writeWorkspaceFile(file.path, nextContent))
			.then(() => setSaveError(''))
			.catch((cause: unknown) => setSaveError(cause instanceof Error ? cause.message : t('workspaceSidebar.saveError', 'Unable to save file.')));
	}, [file, t]);

	useEffect(() => () => { save(); }, [save]);

	useEffect(() => {
		let active = true;
		setContent('');
		setError('');
		setSaveError('');
		if (!file || media || kind === 'unsupported') {
			setLoading(false);
			return () => { active = false; };
		}
		setLoading(true);
		void window.agent.readWorkspaceFile(file.path)
			.then((value) => {
				if (active) setContent(value);
			})
			.catch((cause: unknown) => {
				if (active) setError(cause instanceof Error ? cause.message : t('workspaceSidebar.fileError', 'Unable to open file.'));
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => { active = false; };
	}, [file, kind, media, t]);

	return (
		<section data-slot="workspace-content" aria-label={t('workspaceSidebar.viewer', 'Workspace file')} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
			{file ? (
				<header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border px-4 text-sm">
					<FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
					<span className="truncate font-medium">{file.name}</span>
					<span className="ml-auto truncate text-xs text-muted-foreground" title={file.path}>{file.path}</span>
					{kind === 'markdown' ? (
						<ToggleGroup type="single" size="sm" variant="outline" value={markdownMode} onValueChange={(value) => {
							if (value === 'preview' || value === 'source') setMarkdownMode(value);
						}} aria-label={t('workspaceSidebar.markdownView', 'Markdown view')}>
							<ToggleGroupItem value="preview">{t('workspaceSidebar.preview', 'Preview')}</ToggleGroupItem>
							<ToggleGroupItem value="source">{t('workspaceSidebar.source', 'Source')}</ToggleGroupItem>
						</ToggleGroup>
					) : null}
				</header>
			) : null}
			{!file ? (
				<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
					{t('workspaceSidebar.noSelection', 'Choose a file to view it here.')}
				</div>
			) : loading ? (
				<div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
					<LoaderCircle className="size-4 animate-spin" />{t('workspaceSidebar.fileLoading', 'Loading file…')}
				</div>
			) : error ? (
				<p className="p-4 text-sm text-destructive" role="alert">{error}</p>
			) : kind === 'unsupported' ? (
				<p className="p-4 text-sm text-muted-foreground">{t('workspaceSidebar.unsupported', 'This file cannot be previewed.')}</p>
			) : kind === 'image' ? (
				<div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
					<img src={mediaUrl?.toString()} alt={file.name} className="max-h-full max-w-full object-contain" />
				</div>
			) : kind === 'audio' ? (
				<div className="flex flex-1 items-center justify-center p-4"><audio controls src={mediaUrl?.toString()} /></div>
			) : kind === 'video' ? (
				<div className="flex min-h-0 flex-1 items-center justify-center p-4"><video controls src={mediaUrl?.toString()} className="max-h-full max-w-full" /></div>
			) : kind === 'pdf' ? (
				<iframe title={file.name} src={mediaUrl?.toString()} className="min-h-0 flex-1" />
			) : kind === 'markdown' && markdownMode === 'preview' ? (
				<div className="min-h-0 flex-1 overflow-auto px-6 py-5">
					<Markdown className="mx-auto w-full max-w-3xl break-words text-sm leading-7" components={markdownComponents}>{content}</Markdown>
				</div>
			) : (
				<div className="min-h-0 flex-1 overflow-auto">
					<Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('workspaceSidebar.fileLoading', 'Loading file…')}</div>}>
						<CodeMirrorEditor
							key={file.path}
							value={content}
							onChange={(value) => {
								if (kind !== 'markdown') return;
								setContent(value);
								setSaveError('');
								pendingContent.current = value;
								if (saveTimer.current) clearTimeout(saveTimer.current);
								saveTimer.current = setTimeout(save, 500);
							}}
							onSave={kind === 'markdown' ? save : undefined}
							readOnly={kind !== 'markdown'}
							canSave={kind === 'markdown'}
							code={kind !== 'markdown'}
							foldable={/\.(json|jsonc|json5|toml|xml|ya?ml)$/i.test(file.path)}
							isDark={isDark}
							path={file.path}
							className="h-full min-h-full"
						/>
					</Suspense>
				</div>
			)}
			{saveError ? <p className="shrink-0 border-t border-border p-2 text-sm text-destructive" role="alert">{saveError}</p> : null}
		</section>
	);
}
