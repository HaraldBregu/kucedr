import { useEffect, useRef, useState } from 'react';
import { File } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SPLIT_ITEM_CLASS, SPLIT_ITEM_ACTIVE_CLASS } from '@/components/app/base/page/styles';
import { cn } from '@/lib/utils';
import { isCodingMarkdownFileName } from '@shared/coding_types';

interface WorkspaceFilesProps {
	readonly projectId: string;
	readonly selectedFile: string | null;
	readonly onOpen: (fileName: string) => void;
	readonly creation?: 'markdown' | 'instructions' | null;
	readonly onCancelCreation: () => void;
}

export function WorkspaceFiles({ projectId, selectedFile, onOpen, creation, onCancelCreation }: WorkspaceFilesProps): React.JSX.Element {
	const { t } = useTranslation();
	const [files, setFiles] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [name, setName] = useState('');
	useEffect(() => { setName(creation === 'instructions' ? 'AGENTS.md' : ''); }, [creation]);
	const [busy, setBusy] = useState(false);
	const submitting = useRef(false);
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		let active = true;
		setLoading(true);
		void window.coder.listMarkdownFiles(projectId).then((items) => {
			if (active) { setFiles(items); setError(''); }
		}).catch((cause: unknown) => {
			if (active) setError(cause instanceof Error ? cause.message : t('codeFiles.loadError', 'Unable to load files.'));
		}).finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [projectId, revision, t]);
	return (
		<div className="min-w-0">
			{creation && <form className="flex min-h-8 items-center gap-2 px-2" onSubmit={(event) => {
				event.preventDefault();
				if (submitting.current) return;
				const trimmed = name.trim();
				if (!trimmed) { onCancelCreation(); return; }
				const fileName = trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
				if (!isCodingMarkdownFileName(fileName)) { setError(t('codeFiles.invalidName', 'Enter a Markdown filename without folders.')); return; }
				if (creation === 'instructions' && files.includes(fileName)) { onCancelCreation(); onOpen(fileName); return; }
				submitting.current = true;
				setBusy(true);
				setError('');
				void window.coder.createMarkdownFile(projectId, fileName).then(() => {
					onCancelCreation();
					setRevision((value) => value + 1);
					onOpen(fileName);
				}).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t('codeFiles.createError', 'Unable to create file.'))).finally(() => { submitting.current = false; setBusy(false); });
			}}>
				<File className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
				<Input autoFocus aria-label={t('codeFiles.fileName', 'File name')} placeholder="notes.md" className="h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent" value={name} disabled={busy} onChange={(event) => setName(event.target.value)} onBlur={(event) => {
					if (!submitting.current) event.currentTarget.form?.requestSubmit();
				}} onKeyDown={(event) => {
					if (event.key === 'Escape') {
						event.preventDefault();
						onCancelCreation();
					}
				}} />
			</form>}
			{error && <div className="p-1"><p role="alert" className="text-xs text-destructive">{error}</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}>{t('code.retry', 'Retry')}</Button></div>}
			{loading ? <p className="p-1 text-xs text-muted-foreground">{t('codeFiles.loading', 'Loading files…')}</p> : files.length === 0 && !error ? <p className="p-1 text-xs text-muted-foreground">{t('codeFiles.empty', 'No files yet.')}</p> : files.map((fileName) => <button key={fileName} type="button" className={cn(SPLIT_ITEM_CLASS, selectedFile === fileName && SPLIT_ITEM_ACTIVE_CLASS)} aria-current={selectedFile === fileName ? 'page' : undefined} title={fileName} onClick={() => onOpen(fileName)}><File className="text-muted-foreground" strokeWidth={1.8} /><span>{fileName}</span></button>)}
		</div>
	);
}
