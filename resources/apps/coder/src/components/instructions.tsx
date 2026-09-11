import { useEffect } from 'react';
import { AlertTriangle, FileText, LoaderCircle, Save } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useProjectInstructions } from '@/hooks/instructions';

export function Instructions({
	projectId,
	projectName,
	onDone,
	onDirtyChange,
}: {
	projectId: string;
	projectName: string;
	onDone: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const editor = useProjectInstructions(projectId);

	useEffect(() => onDirtyChange(editor.dirty), [editor.dirty, onDirtyChange]);
	useEffect(() => {
		if (!editor.dirty) return;
		const preventUnsavedClose = (event: BeforeUnloadEvent): void => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', preventUnsavedClose);
		return () => window.removeEventListener('beforeunload', preventUnsavedClose);
	}, [editor.dirty]);

	const status = editor.saving
		? 'Saving…'
		: editor.dirty
			? 'Unsaved'
			: editor.instructions?.exists
				? 'Saved'
				: 'Not created';

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="flex h-11 shrink-0 items-center gap-2 px-3">
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-xs font-medium">Agent instructions · {projectName}</h1>
				</div>
				<span className="text-[11px] text-muted-foreground" aria-live="polite">
					{status}
				</span>
				<Button size="sm" disabled={!editor.canSave} onClick={() => void editor.save()}>
					{editor.saving ? <LoaderCircle className="animate-spin" /> : <Save />}
					Save
				</Button>
				<Button variant="ghost" size="sm" onClick={onDone}>
					Done
				</Button>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
				<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-5">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<FileText className="size-4 text-muted-foreground" />
							<h2 className="text-sm font-medium">
								{editor.instructions?.activeFileName ?? 'Workspace instructions'}
							</h2>
						</div>
						<p className="text-xs leading-5 text-muted-foreground">
							Changes apply to the next Coding message, including resumed sessions. A running tool
							loop keeps the instructions it started with.
						</p>
						{editor.instructions ? (
							<p className="break-all font-mono text-[11px] text-muted-foreground">
								{editor.instructions.activeFilePath}
							</p>
						) : null}
					</div>

					{editor.loading ? (
						<div className="space-y-3">
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-80 w-full" />
						</div>
					) : editor.instructions ? (
						<div className="flex min-h-[360px] flex-1 flex-col gap-2">
							<label htmlFor="coding-agent-instructions" className="text-xs font-medium">
								Workspace instructions
							</label>
							<Textarea
								id="coding-agent-instructions"
								value={editor.content}
								disabled={!editor.instructions.editable || editor.saving}
								onChange={(event) => editor.setContent(event.target.value)}
								spellCheck={false}
								className="min-h-[340px] flex-1 resize-y font-mono text-xs leading-5"
							/>
						</div>
					) : null}

					{editor.instructions && !editor.instructions.editable ? (
						<Alert className="border-destructive/30 bg-destructive/5 text-destructive">
							<AlertTriangle /> This file is a symbolic link and cannot be edited in Kucedr.
						</Alert>
					) : null}
					{editor.error ? (
						<Alert className="border-destructive/30 bg-destructive/5 text-destructive">
							<AlertTriangle /> {editor.error}
						</Alert>
					) : null}

					{editor.instructions ? (
						<section aria-labelledby="coding-instruction-sources" className="space-y-2">
							<h2 id="coding-instruction-sources" className="text-xs font-medium">
								Loaded instruction sources
							</h2>
							{editor.instructions.loadedSources.length ? (
								<ul className="space-y-1.5">
									{editor.instructions.loadedSources.map((source) => (
										<li
											key={source.path}
											className="flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2"
										>
											<Badge variant="outline">
												{source.scope === 'coding-global'
													? 'Coding global'
													: source.scope[0].toUpperCase() + source.scope.slice(1)}
											</Badge>
											<span className="min-w-0 break-all font-mono text-[11px] text-muted-foreground">
												{source.path}
											</span>
										</li>
									))}
								</ul>
							) : (
								<p className="text-xs text-muted-foreground">
									No instruction sources are currently loaded.
								</p>
							)}
						</section>
					) : null}
				</div>
			</div>
		</div>
	);
}
