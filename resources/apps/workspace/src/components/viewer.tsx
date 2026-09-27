import { lazy, Suspense, useEffect, useRef } from 'react';
import { FileQuestion, LoaderCircle, Music2 } from 'lucide-react';
import type { WorkspaceFileKind } from '@kucedr/sdk';
import type { WorkspaceSettings } from '@/lib/settings';

import { TabsContent } from '@/components/ui/tabs';
import {
	VideoPlayer,
	VideoPlayerContent,
	VideoPlayerControlBar,
	VideoPlayerFullscreenButton,
	VideoPlayerMuteButton,
	VideoPlayerPlayButton,
	VideoPlayerTimeDisplay,
	VideoPlayerTimeRange,
} from '@/components/kibo-ui/video-player';
import { copyImage } from '@/lib/image';
import { showMediaContextMenu } from '@/lib/media';
import { showNativeContextMenu } from '@/lib/menu';
import { isStructuredDataPath } from '@/lib/structured';

const CodeMirrorEditor = lazy(async () => {
	const module = await import('@/components/code-mirror-editor');
	return { default: module.CodeMirrorEditor };
});
type CodeMirrorEditorHandle = import('@/components/code-mirror-editor').CodeMirrorEditorHandle;
const MarkdownPreview = lazy(() =>
	import('@/components/markdown').then(({ MarkdownPreview }) => ({ default: MarkdownPreview }))
);
const ExcalidrawEditor = lazy(() => import('@/components/excalidraw'));
const MermaidEditor = lazy(() => import('@/components/mermaid'));
const TldrawEditor = lazy(() => import('@/components/tldraw'));
const viewerFallback = (
	<div className="flex min-h-full items-center justify-center gap-2 text-sm text-muted-foreground">
		<LoaderCircle className="h-4 w-4 animate-spin" /> Loading viewer...
	</div>
);

export interface FileFindControls {
	clear: () => void;
	find: (query: string, direction: 'next' | 'previous') => void;
}

interface FileViewerProps {
	canSave: boolean;
	content: string;
	imageZoom: number;
	isDark: boolean;
	kind: WorkspaceFileKind;
	onChange: (content: string) => void;
	onFindReady?: (controls: FileFindControls | null) => void;
	onSave: () => Promise<boolean>;
	path: string;
	url: string;
	settings: WorkspaceSettings;
}

export function FileViewer({
	canSave,
	content,
	imageZoom,
	isDark,
	kind,
	onChange,
	onFindReady,
	onSave,
	path,
	url,
	settings,
}: FileViewerProps) {
	const name = path.split(/[\\/]/).pop() ?? path;
	const mediaRef = useRef<HTMLMediaElement | null>(null);
	const codeEditorRef = useRef<CodeMirrorEditorHandle>(null);

	useEffect(() => {
		codeEditorRef.current?.clearSearch();
	}, [path]);

	useEffect(() => {
		if (kind !== 'markdown' && kind !== 'text') {
			if (kind !== 'mermaid') onFindReady?.(null);
			return;
		}
		onFindReady?.({
			clear: () => codeEditorRef.current?.clearSearch(),
			find: (query, direction) => codeEditorRef.current?.find(query, direction),
		});
		return () => onFindReady?.(null);
	}, [kind, onFindReady]);

	if (kind === 'markdown') {
		return (
			<>
				<TabsContent
					value="source"
					forceMount
					className="m-0 min-h-full data-[state=inactive]:hidden"
				>
					<article className="relative mx-auto flex min-h-full w-full max-w-[920px] flex-col px-5 pb-12 pt-8 sm:px-8 lg:px-12">
						<Suspense fallback={viewerFallback}>
							<CodeMirrorEditor
								ref={codeEditorRef}
								key={path}
								canSave={canSave}
								fontSize={settings.fontSize}
								value={content}
								onChange={onChange}
								onSave={onSave}
								className="min-h-[calc(100dvh-10rem)] flex-1"
							/>
						</Suspense>
					</article>
				</TabsContent>
				<TabsContent value="preview" className="m-0 min-h-full">
					<Suspense fallback={viewerFallback}>
						<MarkdownPreview canSave={canSave} content={content} onSave={onSave} path={path} />
					</Suspense>
				</TabsContent>
			</>
		);
	}

	if (kind === 'mermaid') {
		return (
			<Suspense fallback={viewerFallback}>
				<MermaidEditor
					canSave={canSave}
					content={content}
					fontSize={settings.fontSize}
					isDark={isDark}
					onChange={onChange}
					onFindReady={onFindReady}
					onSave={onSave}
					path={path}
				/>
			</Suspense>
		);
	}

	if (kind === 'excalidraw') {
		return (
			<Suspense fallback={viewerFallback}>
				<ExcalidrawEditor content={content} isDark={isDark} onChange={onChange} path={path} />
			</Suspense>
		);
	}

	if (kind === 'tldraw') {
		return (
			<Suspense fallback={viewerFallback}>
				<TldrawEditor content={content} isDark={isDark} onChange={onChange} />
			</Suspense>
		);
	}

	if (kind === 'text') {
		return (
			<div className="relative min-h-full">
				<Suspense fallback={viewerFallback}>
					<CodeMirrorEditor
						ref={codeEditorRef}
						key={path}
						canSave={canSave}
						className="min-h-full"
						code
						fontSize={settings.fontSize}
						foldable={isStructuredDataPath(path)}
						isDark={isDark}
						lineNumbersVisible={settings.lineNumbers}
						onChange={onChange}
						onSave={onSave}
						path={path}
						value={content}
						wordWrap={settings.wordWrap}
					/>
				</Suspense>
			</div>
		);
	}

	if (kind === 'image') {
		return (
			<div
				className="flex min-h-full items-center justify-center overflow-auto bg-muted/25 p-6 sm:p-10"
				onContextMenu={(event) => {
					showNativeContextMenu(
						event,
						[
							{ id: 'copy-image', label: 'Copy Image' },
							{ type: 'separator' },
							{ id: 'copy-path', label: 'Copy Path' },
						],
						{
							'copy-image': () => copyImage(url),
							'copy-path': () => navigator.clipboard.writeText(path),
						}
					);
				}}
			>
				<img
					src={url}
					alt={name}
					className="max-h-[calc(100dvh-8rem)] max-w-full origin-center rounded-md object-contain shadow-sm transition-transform duration-150"
					style={{ transform: `scale(${imageZoom})` }}
				/>
			</div>
		);
	}

	if (kind === 'audio') {
		return (
			<div
				className="flex min-h-full items-center justify-center px-6 py-10"
				onContextMenu={(event) => showMediaContextMenu(event, mediaRef.current, path)}
			>
				<div className="w-full max-w-xl rounded-lg border bg-card p-5 shadow-sm">
					<div className="mb-5 flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
							<Music2 className="h-4 w-4" />
						</div>
						<p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
					</div>
					<VideoPlayer audio className="block min-w-0 w-full overflow-hidden rounded-md border">
						<audio
							ref={(element) => {
								mediaRef.current = element;
							}}
							src={url}
							preload="metadata"
							slot="media"
						/>
						<VideoPlayerControlBar className="w-full">
							<VideoPlayerPlayButton />
							<VideoPlayerTimeRange />
							<VideoPlayerTimeDisplay />
							<VideoPlayerMuteButton />
						</VideoPlayerControlBar>
					</VideoPlayer>
				</div>
			</div>
		);
	}

	if (kind === 'video') {
		return (
			<div
				className="flex min-h-full items-center justify-center bg-black/95 p-4 sm:p-8"
				onContextMenu={(event) => showMediaContextMenu(event, mediaRef.current, path)}
			>
				<VideoPlayer className="w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-black shadow-sm">
					<VideoPlayerContent
						ref={(element) => {
							mediaRef.current = element;
						}}
						src={url}
						preload="metadata"
						slot="media"
						className="max-h-[calc(100dvh-8rem)] w-full object-contain"
					/>
					<VideoPlayerControlBar className="w-full">
						<VideoPlayerPlayButton />
						<VideoPlayerTimeRange />
						<VideoPlayerTimeDisplay />
						<VideoPlayerMuteButton />
						<VideoPlayerFullscreenButton />
					</VideoPlayerControlBar>
				</VideoPlayer>
			</div>
		);
	}

	if (kind === 'pdf') {
		return (
			<iframe
				src={url}
				title={name}
				className="h-full min-h-[calc(100dvh-3.5rem)] w-full border-0 bg-white"
			/>
		);
	}

	return (
		<div className="flex min-h-full items-center justify-center px-6 text-center">
			<div>
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<FileQuestion className="h-5 w-5" />
				</div>
				<h2 className="text-sm font-semibold">Preview unavailable</h2>
				<p className="mx-auto mt-1.5 max-w-72 text-xs leading-5 text-muted-foreground">
					This file type does not have a safe built-in preview.
				</p>
			</div>
		</div>
	);
}
