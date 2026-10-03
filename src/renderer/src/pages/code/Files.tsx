import { useEffect, useState } from 'react';
import { FileText, ListChecks, Plus } from 'lucide-react';
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
}

export function WorkspaceFiles({ projectId, selectedFile, onOpen }: WorkspaceFilesProps): React.JSX.Element {
	const { t } = useTranslation();
	const [files, setFiles] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [name, setName] = useState('');
	const [creating, setCreating] = useState(false);
	const [busy, setBusy] = useState(false);
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
		<div className="ml-4 border-l border-sidebar-border pl-1">
			<div className="flex flex-wrap gap-1 py-1">
				<Button variant="ghost" size="xs" disabled={busy} onClick={() => { setName(''); setCreating(true); }}><Plus />{t('codeFiles.newMarkdown', 'Markdown')}</Button>
				<Button variant="ghost" size="xs" disabled={busy} onClick={() => {
					if (files.includes('AGENTS.md')) onOpen('AGENTS.md');
					else { setName('AGENTS.md'); setCreating(true); }
				}}><ListChecks />{t('codeFiles.instructions', 'Instructions')}</Button>
			</div>
			{creating && <form className="grid gap-1 p-1" onSubmit={(event) => {
				event.preventDefault();
				if (busy) return;
				const trimmed = name.trim();
				const fileName = trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
				if (!isCodingMarkdownFileName(fileName)) { setError(t('codeFiles.invalidName', 'Enter a Markdown filename without folders.')); return; }
				setBusy(true);
				setError('');
				void window.coder.createMarkdownFile(projectId, fileName).then(() => {
					setCreating(false);
					setRevision((value) => value + 1);
					onOpen(fileName);
				}).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t('codeFiles.createError', 'Unable to create file.'))).finally(() => setBusy(false));
			}}>
				<Input autoFocus aria-label={t('codeFiles.fileName', 'File name')} placeholder="notes.md" value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
				<div className="flex gap-1"><Button type="submit" size="xs" disabled={busy || !name.trim()}>{t('codeFiles.create', 'Create')}</Button><Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setCreating(false)}>{t('common.cancel', 'Cancel')}</Button></div>
			</form>}
			{error && <div className="p-1"><p role="alert" className="text-xs text-destructive">{error}</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}>{t('code.retry', 'Retry')}</Button></div>}
			{loading ? <p className="p-1 text-xs text-muted-foreground">{t('codeFiles.loading', 'Loading files…')}</p> : files.length === 0 && !error ? <p className="p-1 text-xs text-muted-foreground">{t('codeFiles.empty', 'No files yet.')}</p> : files.map((fileName) => <button key={fileName} type="button" className={cn(SPLIT_ITEM_CLASS, selectedFile === fileName && SPLIT_ITEM_ACTIVE_CLASS)} aria-current={selectedFile === fileName ? 'page' : undefined} title={fileName} onClick={() => onOpen(fileName)}><FileText /><span>{fileName}</span></button>)}
		</div>
	);
}
