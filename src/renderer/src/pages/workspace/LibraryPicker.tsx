import { useEffect, useState } from 'react';
import type { LibraryFile } from '@shared/library_types';
import { workspaceFileType } from '@shared/workspace';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LibraryPreview } from '@/pages/settings/pages/library/Preview';

const assetKinds = new Set(['image', 'audio', 'video', 'pdf']);

interface WorkspaceLibraryPickerProps {
	readonly onClose: () => void;
	readonly onPick: (file: LibraryFile) => void;
}

export function WorkspaceLibraryPicker({ onClose, onPick }: WorkspaceLibraryPickerProps): React.JSX.Element {
	const [files, setFiles] = useState<LibraryFile[] | null>(null);
	const [error, setError] = useState('');
	const [query, setQuery] = useState('');
	useEffect(() => {
		void window.library.list()
			.then((entries) => setFiles(entries.filter((entry) => entry.kind !== 'folder' && assetKinds.has(workspaceFileType(entry.name).kind))))
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load the library.'));
	}, []);
	const visible = files?.filter((file) => file.relativePath.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
	return (
		<Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Insert from Library</DialogTitle>
					<DialogDescription>Choose a file. A copy is added to this document's assets folder.</DialogDescription>
				</DialogHeader>
				<Input autoFocus aria-label="Search library" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
				{error ? (
					<p className="text-sm text-destructive" role="alert">{error}</p>
				) : files === null ? (
					<p className="text-sm text-muted-foreground">Loading library…</p>
				) : visible.length === 0 ? (
					<p className="text-sm text-muted-foreground">{files.length === 0 ? 'The library has no images or media yet.' : 'No matching files.'}</p>
				) : (
					<ul aria-label="Library files" className="grid max-h-[60vh] grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 overflow-y-auto">
						{visible.map((file) => (
							<li key={file.path}>
								<button type="button" title={file.relativePath} className="flex w-full flex-col items-center gap-1 rounded-md p-1.5 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onPick(file)}>
									<LibraryPreview file={file} tile />
									<span className="w-full truncate text-center">{file.name}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
}
