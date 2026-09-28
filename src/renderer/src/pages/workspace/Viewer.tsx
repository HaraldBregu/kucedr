import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Folder, LoaderCircle, Search, X } from 'lucide-react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { workspaceFileType } from '@shared/workspace';
import { Markdown } from '@/components/prompt-kit/markdown';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { useIsDark } from '@/hooks/use-is-dark';
import { markdownComponents } from '@/pages/home/components/markdown';
import { formatFileSize } from '@/pages/home/attachments/size';
import type { CodeMirrorEditorHandle } from './Editor';

const CodeMirrorEditor = lazy(async () => {
	const module = await import('./Editor');
	return { default: module.CodeMirrorEditor };
});
const WorkspaceMarkdownEditor = lazy(async () => {
	const module = await import('./MarkdownEditor');
	return { default: module.WorkspaceMarkdownEditor };
});

interface WorkspaceViewerProps {
	readonly file: WorkspaceTreeEntry | null;
}

export function WorkspaceViewer({ file }: WorkspaceViewerProps): React.JSX.Element {
	const { t } = useTranslation();
	const isDark = useIsDark();
	const reducedMotion = useReducedMotion();
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [saveError, setSaveError] = useState('');
	const [markdownMode, setMarkdownMode] = useState<'preview' | 'source'>('preview');
	const [findOpen, setFindOpen] = useState(false);
	const [findQuery, setFindQuery] = useState('');
	const editorRef = useRef<CodeMirrorEditorHandle>(null);
	const pendingContent = useRef<string | null>(null);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveQueue = useRef(Promise.resolve());
	const filePath = file?.path;
	const kind = file ? workspaceFileType(file.path).kind : null;
	const media = kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'pdf';
	const mediaUrl = file && media ? new URL('local-resource://agent/') : null;
	if (mediaUrl && file) mediaUrl.pathname = `/${file.path.replaceAll('\\', '/')}`;
	const searchable = kind !== null && !media && kind !== 'unsupported';
	const visibleMarkdownMode = kind === 'markdown' && findOpen ? 'source' : markdownMode;
	const pathSegments = file?.path.split(/[\\/]/).filter(Boolean) ?? [];
	const matchCount = findQuery ? content.toLocaleLowerCase().split(findQuery.toLocaleLowerCase()).length - 1 : 0;
	const closeFind = (): void => {
		setFindOpen(false);
		setFindQuery('');
		editorRef.current?.clearSearch();
	};

	const save = useCallback(() => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = null;
		const nextContent = pendingContent.current;
		pendingContent.current = null;
		if (!filePath || nextContent === null) return;
		saveQueue.current = saveQueue.current.then(() => window.agent.writeWorkspaceFile(filePath, nextContent))
			.then(() => setSaveError(''))
			.catch((cause: unknown) => setSaveError(cause instanceof Error ? cause.message : t('workspaceSidebar.saveError', 'Unable to save file.')));
	}, [filePath, t]);

	useEffect(() => () => { save(); }, [save]);

	const handleMarkdownChange = (value: string): void => {
		setContent(value);
		setSaveError('');
		pendingContent.current = value;
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(save, 500);
	};

	useEffect(() => {
		let active = true;
		setContent('');
		setError('');
		setSaveError('');
		if (!filePath || media || kind === 'unsupported') {
			setLoading(false);
			return () => { active = false; };
		}
		setLoading(true);
		void window.agent.readWorkspaceFile(filePath)
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
	}, [filePath, kind, media, t]);
	const codeEditor = file ? (
		<Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('workspaceSidebar.fileLoading', 'Loading file…')}</div>}>
			<CodeMirrorEditor
				ref={editorRef}
				key={file.path}
				value={content}
				onChange={(value) => { if (kind === 'markdown') handleMarkdownChange(value); }}
				onSave={kind === 'markdown' ? save : undefined}
				readOnly={kind !== 'markdown'}
				canSave={kind === 'markdown'}
				code={kind !== 'markdown'}
				foldable={/\.(json|jsonc|json5|toml|xml|ya?ml)$/i.test(file.path)}
				isDark={isDark}
				path={file.path}
				className={kind === 'markdown' ? 'min-h-[calc(100dvh-10rem)] flex-1' : 'h-full min-h-full'}
			/>
		</Suspense>
	) : null;

	return (
		<section data-slot="workspace-content" aria-label={t('workspaceSidebar.viewer', 'Workspace file')} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
			{file ? (
				<header aria-label="File navigation" className="sticky top-0 z-20 flex h-9 shrink-0 items-center gap-1.5 border-b bg-background/95 px-2 backdrop-blur sm:px-3">
					<nav aria-label="File path" className="flex min-w-0 flex-1 items-center overflow-hidden text-xs" title={file.path}>
						<Folder aria-hidden="true" className="mr-1 size-4 shrink-0 text-muted-foreground" />
						{pathSegments.map((segment, index) => (
							<span key={`${index}:${segment}`} className="flex min-w-0 items-center">
								<ChevronRight aria-hidden="true" className="mx-1 size-3 shrink-0 text-muted-foreground" />
								<span className={index === pathSegments.length - 1 ? 'min-w-0 truncate font-medium' : 'min-w-0 truncate text-muted-foreground'}>{segment}</span>
							</span>
						))}
					</nav>
					{searchable ? findOpen ? (
						<div role="search" className="ml-auto flex min-w-0 items-center gap-1">
							<Input autoFocus aria-label="Find in file" placeholder="Find in file" value={findQuery} className="h-7 w-32 shrink-0 border-0 bg-muted/70 px-2 text-xs sm:w-40" onChange={(event) => {
								setFindQuery(event.target.value);
								if (event.target.value) editorRef.current?.find(event.target.value, 'next');
								else editorRef.current?.clearSearch();
							}} onKeyDown={(event) => {
								if (event.key === 'Escape') closeFind();
								if (event.key === 'Enter') editorRef.current?.find(findQuery, event.shiftKey ? 'previous' : 'next');
							}} />
							<span aria-live="polite" className="shrink-0 text-[11px] text-muted-foreground">{findQuery ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}` : 'Find'}</span>
							<Button type="button" variant="ghost" size="icon-sm" aria-label="Previous match" disabled={!matchCount} onClick={() => editorRef.current?.find(findQuery, 'previous')}><ChevronUp /></Button>
							<Button type="button" variant="ghost" size="icon-sm" aria-label="Next match" disabled={!matchCount} onClick={() => editorRef.current?.find(findQuery, 'next')}><ChevronDown /></Button>
							<Button type="button" variant="ghost" size="icon-sm" aria-label="Close find" onClick={closeFind}><X /></Button>
						</div>
					) : <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" aria-label="Find in file" onClick={() => setFindOpen(true)}><Search /></Button> : null}
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
			) : kind === 'markdown' && visibleMarkdownMode === 'preview' ? (
				<div className="min-h-0 flex-1 overflow-auto">
					<article className="workspace-markdown-content mx-auto min-h-full w-full max-w-[920px] px-5 pb-16 pt-8 text-[15px] leading-7 sm:px-8 lg:px-12">
					{content.includes('<!--') ? (
						<>
							<p className="mb-3 text-xs text-muted-foreground">{t('workspaceSidebar.commentSourceOnly', 'This file contains Markdown comments. Edit it in Source to preserve them.')}</p>
							<Markdown className="w-full break-words" components={markdownComponents}>{content}</Markdown>
						</>
					) : (
						<Suspense fallback={<div className="text-sm text-muted-foreground">{t('workspaceSidebar.fileLoading', 'Loading file…')}</div>}>
							<WorkspaceMarkdownEditor value={content} onChange={handleMarkdownChange} onSave={save} />
						</Suspense>
					)}
					</article>
				</div>
			) : (
				<div className="min-h-0 flex-1 overflow-auto">
					{kind === 'markdown' ? (
						<article className="relative mx-auto flex min-h-full w-full max-w-[920px] flex-col px-5 pb-12 pt-8 sm:px-8 lg:px-12">{codeEditor}</article>
					) : codeEditor}
				</div>
			)}
			{saveError ? <p className="shrink-0 border-t border-border p-2 text-sm text-destructive" role="alert">{saveError}</p> : null}
			{file ? (
				<footer aria-label="File information" className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/20 px-2 py-1.5 sm:px-3">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
						{typeof file.size === 'number' ? <span>{formatFileSize(file.size)}</span> : null}
						{file.createdAt ? <time dateTime={file.createdAt} title={new Date(file.createdAt).toLocaleString()}>Created {new Date(file.createdAt).toLocaleString()}</time> : null}
						{file.updatedAt ? <time dateTime={file.updatedAt} title={new Date(file.updatedAt).toLocaleString()}>Updated {new Date(file.updatedAt).toLocaleString()}</time> : null}
					</div>
					{kind === 'markdown' ? (
						<LayoutGroup id="workspace-markdown-mode">
							<ButtonGroup role="group" aria-label={t('workspaceSidebar.markdownView', 'Markdown view')}>
								{([{ mode: 'source', label: 'Raw' }, { mode: 'preview', label: 'Text' }] as const).map(({ mode, label }) => {
									const active = visibleMarkdownMode === mode;
									return (
										<Button
											key={mode}
											type="button"
											variant="outline"
											size="xs"
											aria-pressed={active}
											className={`relative h-6 min-w-12 overflow-hidden rounded-none! px-1 text-[11px] first:rounded-l-lg! last:rounded-r-lg! not-first:-ml-px ${active ? 'border-transparent text-primary-foreground hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
											onClick={() => { closeFind(); setMarkdownMode(mode); }}
										>
											{active ? <motion.span layoutId="active-workspace-markdown-mode" className="absolute inset-0 bg-primary" transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 28 }} /> : null}
											<span className="relative z-10">{label}</span>
										</Button>
									);
								})}
							</ButtonGroup>
						</LayoutGroup>
					) : null}
				</footer>
			) : null}
		</section>
	);
}
