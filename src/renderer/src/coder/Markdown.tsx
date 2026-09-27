import { useEffect, useState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { markdownComponents } from '@/pages/home/components/markdown';
import { Editor } from './Editor';

export function Markdown({
	projectId,
	filePath,
	onDirtyChange,
}: {
	projectId: string;
	filePath: string;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const [content, setContent] = useState('');
	const [saved, setSaved] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [preview, setPreview] = useState(false);
	const dirty = content !== saved;
	useEffect(() => {
		let active = true;
		void window.coder
			.readMarkdownFile(projectId, filePath)
			.then((value) => {
				if (active) {
					setContent(value);
					setSaved(value);
				}
			})
			.catch((cause) => {
				if (active) setError(String(cause));
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [projectId, filePath]);
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
	useEffect(() => {
		if (!dirty) return;
		const preventClose = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', preventClose);
		return () => window.removeEventListener('beforeunload', preventClose);
	}, [dirty]);
	const save = async () => {
		if (loading || saving || !dirty) return;
		const submitted = content;
		setSaving(true);
		setError('');
		try {
			await window.coder.saveMarkdownFile(projectId, filePath, submitted, saved);
			setSaved(submitted);
		} catch (cause) {
			setError(String(cause));
		} finally {
			setSaving(false);
		}
	};
	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
				<h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={filePath}>
					{filePath}
				</h1>
				<span className="text-xs text-muted-foreground" aria-live="polite">
					{saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
				</span>
				<Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
					{preview ? 'Edit' : 'Preview'}
				</Button>
				<Button size="sm" disabled={!dirty || loading || saving} onClick={() => void save()}>
					{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{' '}
					Save
				</Button>
			</header>
			{error && (
				<p role="alert" className="px-4 pt-3 text-sm text-destructive">
					{error}
				</p>
			)}
			{loading ? (
				<p role="status" className="p-4 text-sm text-muted-foreground">
					Loading Markdown…
				</p>
			) : (
				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
					<div className="mx-auto flex min-h-full max-w-[920px] flex-col">
						{preview ? (
							<article className="max-w-none break-words text-sm leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3">
								<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>
									{content}
								</ReactMarkdown>
							</article>
						) : (
							<Editor value={content} onChange={setContent} onSave={() => void save()} />
						)}
					</div>
				</div>
			)}
		</div>
	);
}
