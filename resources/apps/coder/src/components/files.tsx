import { FilePlus2, FileText, Folder, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CodingController } from '@/controller';

export function Files({ coding, onDone }: { coding: CodingController; onDone: () => void }) {
	const project = coding.activeProject;
	const [filePath, setFilePath] = useState('');
	const [files, setFiles] = useState<Awaited<ReturnType<CodingController['listProjectFiles']>>>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;
		if (!project) return;
		setLoading(true);
		void coding
			.listProjectFiles(project.id)
			.then((next) => active && setFiles(next))
			.catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Unable to load files.'))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, [coding, project]);

	const create = async (): Promise<void> => {
		const created = await coding.createProjectFile(filePath);
		if (!created) return;
		setFiles((current) => [...current, created].sort((left, right) => left.path.localeCompare(right.path)));
		setFilePath('');
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-xs font-medium">Files · {project?.name}</h1>
				</div>
				<Button variant="ghost" size="sm" onClick={onDone}>Done</Button>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
				<div className="mx-auto max-w-3xl space-y-5">
					<p className="text-xs text-muted-foreground">Create files anywhere inside this project. Parent folders are created as needed.</p>
					<div className="flex gap-2">
						<Input value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="src/index.ts" onKeyDown={(event) => event.key === 'Enter' && void create()} />
						<Button disabled={!filePath.trim() || coding.busy} onClick={() => void create()}><FilePlus2 /> New file</Button>
					</div>
					{error ? <Alert className="border-destructive/30 bg-destructive/5 text-destructive">{error}</Alert> : null}
					<div className="rounded-lg border">
						{loading ? <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading files</div> : files.length === 0 ? <p className="p-4 text-xs text-muted-foreground">No files yet.</p> : <ul className="divide-y">{files.map((file) => <li key={`${file.type}:${file.path}`} className="flex items-center gap-2 px-3 py-2 text-xs"><span className="text-muted-foreground">{file.type === 'directory' ? <Folder className="size-3.5" /> : <FileText className="size-3.5" />}</span><span className="font-mono">{file.path}</span></li>)}</ul>}
					</div>
				</div>
			</div>
		</div>
	);
}
