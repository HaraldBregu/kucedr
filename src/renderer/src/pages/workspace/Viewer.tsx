import { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { History, ChevronDown, ChevronRight, ChevronUp, Replace, ReplaceAll, LoaderCircle, MoveHorizontal, X } from 'lucide-react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import type { WorkspaceTextSize } from '@shared/app_types';
import { workspaceFileType } from '@shared/workspace';
import { Markdown } from '@/components/prompt-kit/markdown';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsDark } from '@/hooks/use-is-dark';
import { markdownComponents } from '@/pages/home/components/markdown';
import { formatFileSize } from '@/pages/home/attachments/size';
import type { CodeMirrorEditorHandle } from './Editor';
import { importWorkspaceAssets } from './Assets';
import { WorkspaceViewActions } from './Actions';
import { workspaceResourceUrl } from './Resource';

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
	readonly onFileSelect: (file: WorkspaceTreeEntry) => void;
	readonly ref?: React.Ref<() => Promise<void>>;
	readonly wide: boolean;
	readonly onWideChange: (wide: boolean) => void;
	readonly textSize: WorkspaceTextSize;
	readonly onTextSizeChange: (size: WorkspaceTextSize) => void;
}

const TEXT_SIZES = [
	{ size: 'extra-small', label: 'Extra small', zoom: 0.75 },
	{ size: 'small', label: 'Small', zoom: 0.875 },
	{ size: 'medium', label: 'Medium (default)', zoom: 1 },
	{ size: 'large', label: 'Large', zoom: 1.25 },
	{ size: 'extra-large', label: 'Extra large', zoom: 1.5 },
] as const;

export function WorkspaceViewer({ file, onFileSelect, ref, wide, onWideChange, textSize, onTextSizeChange }: WorkspaceViewerProps): React.JSX.Element {
	const { t } = useTranslation();
	const isDark = useIsDark();
	const reducedMotion = useReducedMotion();
	const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(() => file !== null && !['image', 'audio', 'video', 'pdf', 'unsupported'].includes(workspaceFileType(file.path).kind));
	const [error, setError] = useState('');
	const [saveError, setSaveError] = useState('');
	const [markdownMode, setMarkdownMode] = useState<'preview' | 'source'>('preview');
	const [findOpen, setFindOpen] = useState(false);
	const [findQuery, setFindQuery] = useState('');
	const [replaceOpen, setReplaceOpen] = useState(false);
	const [replaceText, setReplaceText] = useState('');
	const editorRef = useRef<CodeMirrorEditorHandle>(null);
	const textRef = useRef<Pick<CodeMirrorEditorHandle, 'find' | 'replace' | 'clearSearch'>>(null);
	const [textMatchCount, setTextMatchCount] = useState(0);
	const pendingContent = useRef<string | null>(null);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveQueue = useRef(Promise.resolve());
	const zoom = TEXT_SIZES.find(({ size }) => size === textSize)?.zoom;
	const filePath = file?.path;
	const kind = file ? workspaceFileType(file.path).kind : null;
	const media = kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'pdf';
	const mediaUrl = file && media ? new URL('local-resource://agent/') : null;
	if (mediaUrl && file) mediaUrl.pathname = `/${file.path.replaceAll('\\', '/')}`;
	const searchable = kind !== null && !media && kind !== 'unsupported';
	const visibleMarkdownMode = kind === 'markdown' && findOpen && content.includes('<!--') ? 'source' : markdownMode;
	const textSearch = kind === 'markdown' && visibleMarkdownMode === 'preview';
	const finder = textSearch ? textRef : editorRef;
	const matchCount = textSearch ? textMatchCount : findQuery ? content.toLocaleLowerCase().split(findQuery.toLocaleLowerCase()).length - 1 : 0;
	const pasteRawAssets = (event: React.ClipboardEvent | React.DragEvent, files: FileList): void => {
		const imported = file ? importWorkspaceAssets(file.path, Array.from(files)) : null;
		if (!imported) return;
		event.preventDefault();
		event.stopPropagation();
		void imported.then((items) => {
			editorRef.current?.wrapSelection(items.map(({ file: asset, src, image }) => `${image ? '!' : ''}[${asset.name.replace(/\.[^.]+$/, '')}](${src})`).join('\n\n'), '');
		}).catch((cause: unknown) => setSaveError(cause instanceof Error ? cause.message : 'Unable to add file.'));
	};
	const openFind = (): void => { setFindOpen(true); };
	const closeFind = (): void => {
		setFindOpen(false);
		setFindQuery('');
		finder.current?.clearSearch();
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
	useImperativeHandle(ref, () => () => {
		save();
		return saveQueue.current;
	}, [save]);

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
		<section data-slot="workspace-content" aria-label={t('workspaceSidebar.viewer', 'Workspace file')} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background" onKeyDown={(event) => {
			if (!searchable || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') return;
			event.preventDefault();
			event.stopPropagation();
			openFind();
		}}>
			<div className="relative flex min-h-0 min-w-0 flex-1">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			{kind === 'markdown' && visibleMarkdownMode === 'preview' && !content.includes('<!--') ? <div ref={setToolbarTarget} hidden /> : null}
			{searchable && findOpen ? (
				<div role="search" className="mx-auto w-full max-w-[920px] space-y-1 px-5 py-2 sm:px-8 lg:px-12">
					<div className="flex min-w-0 items-center gap-1">
						{kind === 'markdown' ? <Button type="button" variant="ghost" size="icon-sm" className="size-5 shrink-0 rounded-sm" aria-label="Toggle replace" aria-expanded={replaceOpen} onClick={() => setReplaceOpen(!replaceOpen)}>{replaceOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</Button> : null}
						<Input autoFocus aria-label="Find in file" placeholder="Find" value={findQuery} className="h-7 min-w-0 flex-1 rounded-sm bg-muted/40 px-2 text-xs" onChange={(event) => {
							setFindOpen(true);
							setFindQuery(event.target.value);
							if (event.target.value) finder.current?.find(event.target.value, 'next'); else finder.current?.clearSearch();
						}} onKeyDown={(event) => { if (event.key === 'Escape') closeFind(); if (event.key === 'Enter') finder.current?.find(findQuery, event.shiftKey ? 'previous' : 'next'); }} />
						<Button type="button" variant="ghost" size="icon-sm" className="size-5 shrink-0 rounded-sm" title="Previous match" aria-label="Previous match" disabled={!matchCount} onClick={() => finder.current?.find(findQuery, 'previous')}><ChevronUp className="size-3.5" /></Button>
						<Button type="button" variant="ghost" size="icon-sm" className="size-5 shrink-0 rounded-sm" title="Next match" aria-label="Next match" disabled={!matchCount} onClick={() => finder.current?.find(findQuery, 'next')}><ChevronDown className="size-3.5" /></Button>
						<Button type="button" variant="ghost" size="icon-sm" className="size-5 shrink-0 rounded-sm" title="Clear search" aria-label="Clear search" onClick={closeFind}><X className="size-3.5" /></Button>
					</div>
					{kind === 'markdown' && replaceOpen ? <div className="flex min-w-0 items-center gap-1 pl-6 pr-6">
						<Input aria-label="Replace with" placeholder="Replace" value={replaceText} className="h-7 min-w-0 flex-1 rounded-sm bg-muted/40 px-2 text-xs" onChange={(event) => setReplaceText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') closeFind(); if (event.key === 'Enter') finder.current?.replace(findQuery, replaceText, event.metaKey || event.ctrlKey); }} />
						<Button type="button" variant="ghost" size="icon-sm" className="size-5 shrink-0 rounded-sm" title="Replace" aria-label="Replace" disabled={!matchCount} onClick={() => finder.current?.replace(findQuery, replaceText, false)}><Replace className="size-3.5" /></Button>
						<Button type="button" variant="ghost" size="icon-sm" className="size-5 shrink-0 rounded-sm" title="Replace all" aria-label="Replace all" disabled={!matchCount} onClick={() => finder.current?.replace(findQuery, replaceText, true)}><ReplaceAll className="size-3.5" /></Button>
					</div> : null}
					{findQuery ? <p aria-live="polite" className={`pl-6 pt-1 text-[11px] ${matchCount ? 'text-muted-foreground' : 'text-destructive'}`}>{matchCount ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}` : 'No results'}</p> : null}
				</div>
			) : null}
			{searchable && (kind !== 'markdown' || visibleMarkdownMode === 'source' || content.includes('<!--')) ? (
				<div role="toolbar" aria-label="File tools" className="flex shrink-0 items-center border-b px-2 py-1 sm:px-3">
					<WorkspaceViewActions wide={wide} onWideChange={onWideChange} onFind={openFind} />
				</div>
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
			) : kind === 'markdown' && visibleMarkdownMode === 'preview' && content.includes('<!--') ? (
				<div className="min-h-0 flex-1 overflow-auto" style={{ zoom }}>
					<article className={`workspace-markdown-content mx-auto min-h-full w-full ${wide ? '' : 'max-w-[920px]'} px-5 pb-16 pt-24 text-[15px] leading-7 sm:px-8 lg:px-12`}>
						<p className="mb-3 text-xs text-muted-foreground">{t('workspaceSidebar.commentSourceOnly', 'This file contains Markdown comments. Edit it in Source to preserve them.')}</p>
						<Markdown className="w-full break-words" components={{ ...markdownComponents, img: ({ src, alt }) => <img src={typeof src === 'string' ? workspaceResourceUrl(file.path, src) : undefined} alt={alt ?? ''} /> }}>{content}</Markdown>
					</article>
				</div>
			) : kind === 'markdown' && visibleMarkdownMode === 'preview' ? (
				<Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('workspaceSidebar.fileLoading', 'Loading file…')}</div>}>
					<WorkspaceMarkdownEditor toolbarTarget={toolbarTarget} ref={textRef} onMatchCount={setTextMatchCount} path={file.path} value={content} onChange={handleMarkdownChange} onSave={save} onError={setSaveError} wide={wide} onWideChange={onWideChange} zoom={zoom} onFind={openFind} onOpenLink={(href) => {
						if (/^[a-z][a-z\d+.-]*:/i.test(href)) void window.app.openExternalUrl(href);
						else {
							const path = decodeURIComponent(new URL(workspaceResourceUrl(file.path, href)).pathname.slice(1));
							onFileSelect({ type: 'file', path, name: path.split('/').pop() ?? path });
						}
					}} />
				</Suspense>
			) : (
				<div className="min-h-0 flex-1 overflow-auto" style={{ zoom }}>
					{kind === 'markdown' ? (
						<article className={`relative mx-auto flex min-h-full w-full ${wide ? '' : 'max-w-[920px]'} flex-col px-5 pb-12 pt-24 sm:px-8 lg:px-12`} onPasteCapture={(event) => pasteRawAssets(event, event.clipboardData.files)} onDropCapture={(event) => pasteRawAssets(event, event.dataTransfer.files)}>{codeEditor}</article>
					) : codeEditor}
				</div>
			)}
			{saveError ? <p className="shrink-0 border-t border-border p-2 text-sm text-destructive" role="alert">{saveError}</p> : null}
			</div>

			</div>
			{file ? (
				<footer aria-label="File information" className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 sm:px-3">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
						{typeof file.size === 'number' ? <span>{formatFileSize(file.size)}</span> : null}
						{kind === 'markdown' ? <span>{content.split(/\s+/).filter(Boolean).length} words</span> : null}
						{file.updatedAt || file.createdAt ? <time dateTime={file.updatedAt || file.createdAt} aria-label={`${file.updatedAt ? 'Updated' : 'Created'} ${new Date((file.updatedAt || file.createdAt)!).toLocaleString()}`} className="inline-flex items-center gap-1"><History className="size-3" aria-hidden="true" />{new Date((file.updatedAt || file.createdAt)!).toLocaleString()}</time> : null}
					</div>
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Full width" aria-pressed={wide} className={wide ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'} onClick={() => onWideChange(!wide)}><MoveHorizontal /></Button>
					<Select value={textSize} onValueChange={(value) => { if (value) onTextSizeChange(value); }}>
						<SelectTrigger size="sm" aria-label="Text size" className="h-6! text-[11px]">
							<SelectValue>{TEXT_SIZES.find(({ size }) => size === textSize)?.label}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{TEXT_SIZES.map(({ size, label }) => <SelectItem key={size} value={size}>{label}</SelectItem>)}
						</SelectContent>
					</Select>
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
											className={`relative h-6 min-w-12 overflow-hidden rounded-none! px-1 text-[11px] first:rounded-l-lg! last:rounded-r-lg! not-first:-ml-px ${active ? 'border-primary! text-primary-foreground hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
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
