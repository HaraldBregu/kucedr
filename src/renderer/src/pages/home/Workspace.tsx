import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, File, FolderOpen, Plus } from 'lucide-react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { workspaceFileType } from '@shared/workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { attachmentPath } from './attachments/path';

const BATCH_SIZE = 50;

export function ChatWorkspace({ onAttach }: {
	readonly onAttach: (files: File[]) => void;
}): React.JSX.Element {
	const [files, setFiles] = useState<WorkspaceTreeEntry[]>([]);
	const [root, setRoot] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [revision, setRevision] = useState(0);
	const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
	const [query, setQuery] = useState('');
	const [attachError, setAttachError] = useState(false);
	const filtered = useMemo(() => {
		const search = query.trim().toLowerCase();
		return search ? files.filter((file) => file.path.toLowerCase().includes(search)) : files;
	}, [files, query]);
	useEffect(() => {
		let active = true;
		let refreshTimer: number | undefined;
		const load = (): void => {
			void Promise.all([window.agent.listWorkspaceFiles(), window.agent.getWorkspaceLocation()]).then(([entries, location]) => {
				if (!active) return;
				setRoot(location.replace(/[\\/]+$/, ''));
				const pending = [...entries].reverse();
				const items: WorkspaceTreeEntry[] = [];
				while (pending.length) {
					const entry = pending.pop()!;
					if (entry.type === 'file') items.push(entry);
					else if (entry.children) pending.push(...[...entry.children].reverse());
				}
				setFiles(items);
				setError(false);
			}).catch(() => {
				if (active) setError(true);
			}).finally(() => {
				if (active) setLoading(false);
			});
		};
		const unsubscribe = window.agent.onWorkspaceChanged((event) => {
			if (event.type === 'change') return;
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(load, 100);
		});
		load();
		return () => { active = false; window.clearTimeout(refreshTimer); unsubscribe(); };
	}, [revision]);
	return (
		<Collapsible onOpenChange={(open) => { if (!open) setVisibleCount(BATCH_SIZE); }}>
			<CollapsibleTrigger render={<Button variant="ghost" className="group h-8 w-full justify-start gap-2 rounded-none px-3 font-medium aria-expanded:bg-transparent" />}>
				<FolderOpen className="size-4 text-muted-foreground" aria-hidden />
				<span className="flex-1 text-left">Workspace</span>
				<span className="text-xs tabular-nums text-muted-foreground">{files.length}</span>
				<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="px-3 pb-2"><Input aria-label="Search workspace files" placeholder="Search files…" value={query} className="h-8 text-xs" onChange={(event) => { setQuery(event.target.value); setVisibleCount(BATCH_SIZE); }} /></div>
				{attachError && <p role="alert" className="px-3 pb-2 text-xs text-destructive">File could not be attached. Please try again.</p>}
				{loading ? <p className="px-3 pb-3 text-xs text-muted-foreground">Loading Workspace…</p> : error ? <div className="px-3 pb-3"><p role="alert" className="text-xs text-destructive">Workspace could not be loaded.</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}>Retry</Button></div> : filtered.length ? <ul aria-label="Workspace files" className="max-h-64 space-y-0.5 overflow-y-auto px-1 pb-2" onScroll={(event) => {
					const viewport = event.currentTarget;
					if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 76) setVisibleCount((count) => Math.min(count + BATCH_SIZE, filtered.length));
				}}>
					{filtered.slice(0, visibleCount).map((file) => <li key={file.path}>
						<Button variant="ghost" className="h-9 w-full justify-start gap-2 px-2 font-normal" title={file.path} aria-label={`Attach ${file.path}`} onClick={() => {
							const path = `${root}/${file.path}`;
							setAttachError(false);
							void window.agent.readPromptFile(path).then((data) => {
								const attachment = new globalThis.File([new Uint8Array(data)], file.name, { type: workspaceFileType(file.name).mimeType ?? '' });
								attachmentPath(attachment, path);
								onAttach([attachment]);
							}).catch(() => setAttachError(true));
						}}>
							<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/40"><File className="size-3.5 text-muted-foreground" aria-hidden /></span>
							<span className="min-w-0 flex-1 truncate text-left text-xs">{file.name}</span>
							<Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
						</Button>
					</li>)}
					{visibleCount < filtered.length && <li><Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setVisibleCount((count) => Math.min(count + BATCH_SIZE, filtered.length))}>Show more</Button></li>}
				</ul> : <p className="px-3 pb-3 text-xs text-muted-foreground">{files.length ? 'No matching files.' : 'Workspace is empty.'}</p>}
			</CollapsibleContent>
		</Collapsible>
	);
}
