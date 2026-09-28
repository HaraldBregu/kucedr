import { useEffect, useState } from 'react';
import { Download, ExternalLink, Save, Trash2 } from 'lucide-react';
import type { DriveFile, DriveUpdateInput } from '@shared/drive_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface DriveInspectorProps {
	readonly file: DriveFile | null;
	readonly folders: DriveFile[];
	readonly busy: boolean;
	readonly onUpdate: (id: string, input: DriveUpdateInput) => Promise<void>;
	readonly onTrash: (file: DriveFile) => void;
	readonly onDownload: (file: DriveFile) => void;
}

export function DriveInspector({ file, folders, busy, onUpdate, onTrash, onDownload }: DriveInspectorProps): React.JSX.Element {
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [properties, setProperties] = useState('');
	const [parentId, setParentId] = useState('');
	const [content, setContent] = useState('');
	const [contentAvailable, setContentAvailable] = useState(false);
	const [loadingContent, setLoadingContent] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const fileId = file?.id;
	const editableContent = file?.mimeType.startsWith('text/') === true;

	useEffect(() => {
		setName(file?.name ?? '');
		setDescription(file?.description ?? '');
		setProperties(JSON.stringify(file?.properties ?? {}, null, 2));
		setParentId(file?.parents?.[0] ?? 'root');
		setError('');
		setMessage('');
	}, [file]);

	useEffect(() => {
		setContent('');
		setContentAvailable(false);
		if (!fileId || !editableContent) return;
		let active = true;
		setLoadingContent(true);
		void window.drive.read(fileId).then((result) => {
			if (active) {
				setContent(result.content);
				setContentAvailable(true);
			}
		}).catch(() => {
			if (active) setContentAvailable(false);
		}).finally(() => {
			if (active) setLoadingContent(false);
		});
		return () => { active = false; };
	}, [fileId, editableContent]);

	const saveMetadata = async (): Promise<void> => {
		if (!file) return;
		setError('');
		setMessage('');
		try {
			const parsed = JSON.parse(properties) as unknown;
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some((value) => typeof value !== 'string')) throw new Error('Properties must be a JSON object with text values.');
			await onUpdate(file.id, { name: name.trim(), description, properties: parsed as Record<string, string>, ...(parentId !== (file.parents?.[0] ?? 'root') ? { parentId } : {}) });
			setMessage('Metadata saved.');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	};

	const saveContent = async (): Promise<void> => {
		if (!file) return;
		setError('');
		setMessage('');
		try {
			await onUpdate(file.id, { content });
			setMessage('Content saved.');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	};

	if (!file) return <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted-foreground">Choose a Drive file to view it here.</div>;

	return (
		<section aria-label="Drive file details" className="min-h-0 flex-1 overflow-y-auto">
			<header className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
				<h2 className="min-w-0 flex-1 truncate text-base font-medium" title={file.name}>{file.name}</h2>
				<Button type="button" variant="outline" size="sm" disabled={busy || file.mimeType === 'application/vnd.google-apps.folder'} onClick={() => onDownload(file)}><Download className="size-4" />Download</Button>
				{file.webViewLink ? <Button render={<a href={file.webViewLink} target="_blank" rel="noreferrer" />} variant="outline" size="sm"><ExternalLink className="size-4" />Open</Button> : null}
				<Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${file.name} to trash`} disabled={busy} onClick={() => onTrash(file)}><Trash2 className="size-4" /></Button>
			</header>
			<div className="mx-auto grid w-full max-w-3xl gap-6 p-5">
				{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
				{message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
				<section className="grid gap-3" aria-label="File metadata">
					<h3 className="text-sm font-medium">Metadata</h3>
					<label className="grid gap-1 text-xs text-muted-foreground">Name<Input value={name} onChange={(event) => setName(event.target.value)} /></label>
					<label className="grid gap-1 text-xs text-muted-foreground">Description<Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>
					<label className="grid gap-1 text-xs text-muted-foreground">Folder<select aria-label="Folder" className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="root">My Drive</option>{folders.filter((folder) => folder.id !== file.id).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
					<label className="grid gap-1 text-xs text-muted-foreground">Properties (JSON)<Textarea value={properties} onChange={(event) => setProperties(event.target.value)} rows={3} spellCheck={false} /></label>
					<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{file.mimeType}{file.modifiedTime ? ` · Modified ${new Date(file.modifiedTime).toLocaleString()}` : ''}</span><Button type="button" size="sm" disabled={busy || !name.trim()} onClick={() => void saveMetadata()}><Save className="size-4" />Save metadata</Button></div>
				</section>
				{file.mimeType !== 'application/vnd.google-apps.folder' ? <section className="grid gap-3 border-t pt-5" aria-label="File content"><h3 className="text-sm font-medium">Content</h3>{!editableContent ? <p className="text-sm text-muted-foreground">Preview and editing are available for text files. You can download this file or edit its metadata.</p> : loadingContent ? <p className="text-sm text-muted-foreground">Loading content…</p> : contentAvailable ? <><Textarea aria-label="File content" value={content} onChange={(event) => setContent(event.target.value)} className="min-h-52 font-mono text-xs" /><div className="flex justify-end"><Button type="button" size="sm" disabled={busy} onClick={() => void saveContent()}><Save className="size-4" />Save content</Button></div></> : <p className="text-sm text-muted-foreground">Content preview is unavailable for this file. You can still edit its metadata or download it.</p>}</section> : null}
			</div>
		</section>
	);
}
