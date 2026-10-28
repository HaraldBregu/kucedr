import { useEffect, useState } from 'react';
import { ChevronDown, Library as LibraryIcon, Plus } from 'lucide-react';
import type { LibraryFile } from '@shared/library_types';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LibraryPreview } from '../settings/pages/library/Preview';
import { LIBRARY_DRAG_TYPE } from '../settings/pages/library/drag';

export function ChatLibrary({ refreshKey, onAttach }: {
	readonly refreshKey: string;
	readonly onAttach: (files: LibraryFile[]) => void;
}): React.JSX.Element {
	const [files, setFiles] = useState<LibraryFile[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		let active = true;
		const load = (): void => {
			setLoading(true);
			setError(false);
			void window.library.list().then((entries) => {
				if (active) setFiles(entries.filter((file) => file.kind !== 'folder'));
			}).catch(() => {
				if (active) setError(true);
			}).finally(() => {
				if (active) setLoading(false);
			});
		};
		load();
		window.addEventListener('focus', load);
		return () => { active = false; window.removeEventListener('focus', load); };
	}, [refreshKey, revision]);
	return (
		<Collapsible defaultOpen className="border-t border-border">
			<CollapsibleTrigger render={<Button variant="ghost" className="group h-11 w-full justify-start rounded-none px-3 font-normal" />}>
				<LibraryIcon className="size-4 text-muted-foreground" aria-hidden />
				<span className="flex-1 text-left">Library</span>
				<span className="text-xs tabular-nums text-muted-foreground">{files.length}</span>
				<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden />
			</CollapsibleTrigger>
			<CollapsibleContent>
				{loading ? <p className="px-3 pb-3 text-xs text-muted-foreground">Loading Library…</p> : error ? <div className="px-3 pb-3"><p role="alert" className="text-xs text-destructive">Library could not be loaded.</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}>Retry</Button></div> : files.length ? <>
					<p className="px-3 pb-2 text-xs text-muted-foreground">Drag files into your message.</p>
					<ul className="max-h-64 overflow-y-auto px-2 pb-2">
						{files.map((file) => <li key={file.relativePath}>
							<Button variant="ghost" draggable className="h-auto min-h-10 w-full cursor-grab justify-start px-2 py-1.5 font-normal active:cursor-grabbing" title={file.relativePath} aria-label={`Attach ${file.relativePath}`} onClick={() => onAttach([file])} onDragStart={(event) => {
								event.dataTransfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify([file.relativePath]));
								event.dataTransfer.effectAllowed = 'copy';
							}}>
								<LibraryPreview file={file} compact />
								<span className="min-w-0 flex-1 truncate text-left text-xs">{file.name}</span>
								<Plus className="size-3 shrink-0 text-muted-foreground" aria-hidden />
							</Button>
						</li>)}
					</ul>
				</> : <p className="px-3 pb-3 text-xs text-muted-foreground">Your Library is empty.</p>}
			</CollapsibleContent>
		</Collapsible>
	);
}
