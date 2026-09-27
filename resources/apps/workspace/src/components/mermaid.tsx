import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RenderResult } from 'mermaid';

import { CodeMirrorEditor, type CodeMirrorEditorHandle } from '@/components/code-mirror-editor';
import type { FileFindControls } from '@/components/viewer';
import { renderMermaid } from '@/lib/mermaid';

interface MermaidEditorProps {
	canSave: boolean;
	content: string;
	fontSize: number;
	isDark: boolean;
	onChange: (content: string) => void;
	onFindReady?: (controls: FileFindControls | null) => void;
	onSave: () => Promise<boolean>;
	path: string;
}

export default function MermaidEditor({
	canSave,
	content,
	fontSize,
	isDark,
	onChange,
	onFindReady,
	onSave,
	path,
}: MermaidEditorProps) {
	const [svg, setSvg] = useState('');
	const [error, setError] = useState('');
	const [rendering, setRendering] = useState(false);
	const [bindFunctions, setBindFunctions] = useState<RenderResult['bindFunctions']>();
	const previewRef = useRef<HTMLDivElement>(null);
	const codeEditorRef = useRef<CodeMirrorEditorHandle>(null);
	const generation = useRef(0);

	useEffect(() => {
		onFindReady?.({
			clear: () => codeEditorRef.current?.clearSearch(),
			find: (query, direction) => codeEditorRef.current?.find(query, direction),
		});
		return () => onFindReady?.(null);
	}, [onFindReady]);

	useEffect(() => {
		const current = ++generation.current;
		if (!content.trim()) {
			setSvg('');
			setError('');
			setRendering(false);
			return;
		}
		setRendering(true);
		const timer = window.setTimeout(() => {
			void renderMermaid(content, isDark)
				.then((result) => {
					if (generation.current !== current) return;
					setSvg(result.svg);
					setBindFunctions(() => result.bindFunctions);
					setError('');
				})
				.catch((reason) => {
					if (generation.current !== current) return;
					setError(reason instanceof Error ? reason.message : 'Unable to render this diagram.');
				})
				.finally(() => {
					if (generation.current === current) setRendering(false);
				});
		}, 300);
		return () => window.clearTimeout(timer);
	}, [content, isDark]);

	useEffect(() => {
		if (svg && previewRef.current) bindFunctions?.(previewRef.current);
	}, [bindFunctions, svg]);

	return (
		<div className="grid h-full min-h-0 grid-rows-2 bg-background md:grid-cols-2 md:grid-rows-1">
			<section
				className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r"
				aria-label="Mermaid source"
			>
				<header className="flex h-9 shrink-0 items-center justify-between border-b bg-muted/30 px-3 text-[11px] font-medium text-muted-foreground">
					<span>Source</span>
					<span>{path.endsWith('.mermaid') ? '.mermaid' : '.mmd'}</span>
				</header>
				<div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
					<CodeMirrorEditor
						ref={codeEditorRef}
						key={path}
						canSave={canSave}
						className="h-full min-h-0 [&_.cm-content]:min-h-full [&_.cm-editor]:h-full"
						fontSize={fontSize}
						onChange={onChange}
						onSave={onSave}
						value={content}
					/>
				</div>
			</section>
			<section className="flex min-h-0 flex-col" aria-label="Mermaid preview">
				<header className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/30 px-3 text-[11px] font-medium text-muted-foreground">
					<span>Preview</span>
					{rendering ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
				</header>
				<div className="relative min-h-0 flex-1 overflow-auto p-5">
					{error ? (
						<div
							className="mx-auto flex max-w-lg gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
							role="alert"
						>
							<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
							<pre className="whitespace-pre-wrap font-sans">{error}</pre>
						</div>
					) : svg ? (
						<div
							ref={previewRef}
							className="mx-auto flex min-h-full min-w-fit items-center justify-center [&_svg]:h-auto [&_svg]:max-w-full"
							dangerouslySetInnerHTML={{ __html: svg }}
						/>
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Write Mermaid source to preview the diagram.
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
