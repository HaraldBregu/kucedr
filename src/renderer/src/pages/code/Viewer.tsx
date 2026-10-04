import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useIsDark } from '@/hooks/use-is-dark';
import { drafts, type Draft } from './drafts';

const CodeMirrorEditor = lazy(async () => ({ default: (await import('../workspace/Editor')).CodeMirrorEditor }));


export function CodeFileViewer({ projectId, fileName, actions, footer, onContentChange }: { readonly projectId: string; readonly fileName: string; readonly actions?: ReactNode; readonly footer?: ReactNode; readonly onContentChange?: (content: string | null) => void }): React.JSX.Element {
	const { t } = useTranslation();
	const isDark = useIsDark();
	const key = JSON.stringify([projectId, fileName]);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [reload, setReload] = useState(0);
	const active = useRef(false);

	useEffect(() => {
		let cancelled = false;
		active.current = true;
		setLoading(true);
		setDraft(null);
		setError('');
		void (async () => {
			const cached = drafts.get(key);
			await cached?.pending;
			const content = cached ? cached.content : await window.coder.readMarkdownFile(projectId, fileName);
			if (cancelled) return;
			const next = cached ?? { content, saved: content, error: '' };
			setDraft({ ...next });
			setError(next.error);
		})().catch((cause: unknown) => {
			if (!cancelled) setError(cause instanceof Error ? cause.message : t('codeFiles.loadError', 'Unable to open file.'));
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => { cancelled = true; active.current = false; };
	}, [key, projectId, fileName, reload, t]);

	useEffect(() => { onContentChange?.(draft?.content ?? null); }, [draft?.content, onContentChange]);

	const save = (): void => {
		if (!draft || loading || saving || draft.content === draft.saved) return;
		const current = { ...draft };
		const content = draft.content;
		setSaving(true);
		setError('');
		current.error = '';
		drafts.set(key, current);
		current.pending = window.coder.saveMarkdownFile(projectId, fileName, content, draft.saved).then(() => {
			current.saved = content;
			if (current.content === content) drafts.delete(key);
			if (active.current) setDraft({ ...current });
		}).catch((cause: unknown) => {
			current.error = cause instanceof Error ? cause.message : t('codeFiles.saveError', 'Unable to save file.');
			if (active.current) setError(current.error);
		}).finally(() => {
			current.pending = undefined;
			if (active.current) setSaving(false);
		});
	};
	const dirty = draft !== null && draft.content !== draft.saved;
	return (
		<section aria-label={fileName} className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
			<header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
				<h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={fileName}>{fileName}</h1>
				<span role="status" className="text-xs text-muted-foreground">{loading ? t('codeFiles.loading', 'Loading file…') : saving ? t('codeFiles.saving', 'Saving…') : draft ? dirty ? t('codeFiles.unsaved', 'Unsaved changes') : t('codeFiles.saved', 'Saved') : null}</span>
				{actions}
			</header>
			{error ? <div className="flex shrink-0 items-center gap-3 border-b p-3">
				<p role="alert" className="min-w-0 flex-1 text-sm text-destructive">{error}</p>
				<Button variant="outline" size="sm" disabled={saving || loading} onClick={() => {
					drafts.delete(key);
					setDraft(null);
					setReload((value) => value + 1);
				}}>{dirty ? t('codeFiles.discardReload', 'Discard edits and reload') : t('codeFiles.reload', 'Reload')}</Button>
			</div> : null}
			{!loading && draft ? <div className="min-h-0 flex-1 overflow-auto">
				<Suspense fallback={<p className="p-4 text-sm text-muted-foreground">{t('codeFiles.loading', 'Loading file…')}</p>}>
					<CodeMirrorEditor path={fileName} value={draft.content} isDark={isDark} readOnly={saving} canSave={!saving && dirty} onSave={save} className="min-h-full" onChange={(content) => {
						const next = { ...draft, content };
						if (content === next.saved) drafts.delete(key);
						else drafts.set(key, next);
						setDraft(next);
					}} />
				</Suspense>
			</div> : null}
			{footer}
		</section>
	);
}
