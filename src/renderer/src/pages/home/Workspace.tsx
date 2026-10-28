import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, File, FolderOpen } from 'lucide-react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function ChatWorkspace(): React.JSX.Element {
	const navigate = useNavigate();
	const [files, setFiles] = useState<WorkspaceTreeEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		let active = true;
		let refreshTimer: number | undefined;
		const load = (): void => {
			void window.agent.listWorkspaceFiles().then((entries) => {
				if (!active) return;
				const pending = [...entries];
				const items: WorkspaceTreeEntry[] = [];
				while (pending.length) {
					const entry = pending.shift()!;
					if (entry.type === 'file') items.push(entry);
					else if (entry.children) pending.unshift(...entry.children);
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
		<Collapsible className="border-t border-border">
			<CollapsibleTrigger render={<Button variant="ghost" className="group h-10 w-full justify-start gap-2 rounded-none px-3 font-medium aria-expanded:bg-transparent" />}>
				<FolderOpen className="size-4 text-muted-foreground" aria-hidden />
				<span className="flex-1 text-left">Workspace</span>
				<span className="text-xs tabular-nums text-muted-foreground">{files.length}</span>
				<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden />
			</CollapsibleTrigger>
			<CollapsibleContent>
				{loading ? <p className="px-3 pb-3 text-xs text-muted-foreground">Loading Workspace…</p> : error ? <div className="px-3 pb-3"><p role="alert" className="text-xs text-destructive">Workspace could not be loaded.</p><Button variant="ghost" size="xs" onClick={() => setRevision((value) => value + 1)}>Retry</Button></div> : files.length ? <ul className="max-h-64 space-y-0.5 overflow-y-auto px-1 pb-2">
					{files.map((file) => <li key={file.path}>
						<Button variant="ghost" className="h-9 w-full justify-start gap-2 px-2 font-normal" title={file.path} aria-label={`Open ${file.path} in Workspace`} onClick={() => {
							localStorage.setItem('workspace-selected-file', file.path);
							navigate('/workspace');
						}}>
							<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/40"><File className="size-3.5 text-muted-foreground" aria-hidden /></span>
							<span className="min-w-0 flex-1 truncate text-left text-xs">{file.name}</span>
							<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
						</Button>
					</li>)}
				</ul> : <p className="px-3 pb-3 text-xs text-muted-foreground">Workspace is empty.</p>}
			</CollapsibleContent>
		</Collapsible>
	);
}
