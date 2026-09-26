import { useEffect, useState } from 'react';
import { FileCode2 } from 'lucide-react';
import type { CodingProjectFile, CodingSessionSnapshot } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { Transcript } from './Transcript';

export function Viewer({
	projectId,
	snapshot,
	revision,
}: {
	projectId: string;
	snapshot: CodingSessionSnapshot | null;
	revision: number;
}) {
	const [tab, setTab] = useState<'files' | 'session'>('files');
	const [files, setFiles] = useState<CodingProjectFile[]>([]);
	const [path, setPath] = useState('');
	const [content, setContent] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [listing, setListing] = useState(false);
	useEffect(() => {
		setPath('');
		setContent('');
	}, [projectId]);
	useEffect(() => {
		let active = true;
		setFiles([]);
		setError('');
		if (!projectId) return;
		setListing(true);
		void window.coding
			.listProjectFiles(projectId)
			.then((items) => {
				if (active) setFiles(items.filter((file) => file.type === 'file'));
			})
			.catch((cause: Error) => active && setError(cause.message))
			.finally(() => active && setListing(false));
		return () => {
			active = false;
		};
	}, [projectId, revision]);
	useEffect(() => {
		let active = true;
		setContent('');
		if (!projectId || !path) return;
		setLoading(true);
		setError('');
		void window.coding
			.readProjectFile(projectId, path)
			.then((text) => active && setContent(text))
			.catch((cause: Error) => active && setError(cause.message))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, [projectId, path, revision]);
	return (
		<aside
			aria-label="Content viewer"
			className="flex h-full min-h-0 min-w-0 flex-col bg-background"
		>
			<div
				className="flex h-12 shrink-0 items-center gap-1 border-b px-3"
				role="tablist"
				aria-label="Viewer"
			>
				{(['files', 'session'] as const).map((value) => (
					<Button
						key={value}
						role="tab"
						aria-selected={tab === value}
						variant={tab === value ? 'secondary' : 'ghost'}
						size="sm"
						onClick={() => setTab(value)}
					>
						{value === 'files' ? 'Files' : 'Session'}
					</Button>
				))}
			</div>
			<div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
				{tab === 'session' ? (
					<div className="overflow-auto p-4">
						{snapshot ? (
							<>
								<h2 className="mb-6 text-sm font-semibold">{snapshot.session.title}</h2>
								<Transcript blocks={snapshot.blocks} />
							</>
						) : (
							<p className="text-sm text-muted-foreground">Select a session to view its content.</p>
						)}
					</div>
				) : (
					<>
						<div className="max-h-48 shrink-0 overflow-auto border-b p-2" aria-busy={listing}>
							{listing ? (
								<p className="p-2 text-xs text-muted-foreground">Loading files…</p>
							) : files.length ? (
								files.map((file) => (
									<Button
										key={file.path}
										variant={path === file.path ? 'secondary' : 'ghost'}
										size="sm"
										className="w-full justify-start font-normal"
										onClick={() => setPath(file.path)}
										title={file.path}
									>
										<FileCode2 className="size-4 shrink-0" />
										<span className="truncate">{file.path}</span>
									</Button>
								))
							) : (
								<p className="p-2 text-xs text-muted-foreground">No project files.</p>
							)}
						</div>
						{error && (
							<p role="alert" className="p-3 text-xs text-destructive">
								{error}
							</p>
						)}
						{path ? (
							<>
								<div
									className="truncate border-b px-4 py-2 text-xs text-muted-foreground"
									title={path}
								>
									{path}
								</div>
								<pre
									aria-label="File content"
									aria-busy={loading}
									className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-6"
								>
									{loading ? 'Loading file…' : content}
								</pre>
							</>
						) : (
							<p className="p-4 text-sm text-muted-foreground">Select a file to preview.</p>
						)}
					</>
				)}
			</div>
		</aside>
	);
}
