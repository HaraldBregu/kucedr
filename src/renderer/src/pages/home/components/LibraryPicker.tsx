import { useEffect, useState, type ReactElement } from 'react';
import { Library } from 'lucide-react';
import type { LibraryFile } from '../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { libraryFileIcon } from '../../settings/pages/library/icon';

export function LibraryPicker({
	open,
	onOpenChange,
	onSelect,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onSelect: (files: LibraryFile[]) => void;
}): ReactElement {
	const [files, setFiles] = useState<LibraryFile[]>([]);
	const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		if (!open) return;
		let active = true;
		setLoading(true);
		setError(false);
		setSelectedPaths(new Set());
		void window.library
			.list()
			.then((entries) => {
				if (active) setFiles(entries.filter((entry) => entry.kind !== 'folder'));
			})
			.catch(() => {
				if (active) setError(true);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add from Library</DialogTitle>
					<DialogDescription>Select one or more files from your app Library.</DialogDescription>
				</DialogHeader>
				<div className="max-h-80 overflow-y-auto rounded-lg border">
					{loading ? (
						<p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading Library…</p>
					) : error ? (
						<p className="px-4 py-8 text-center text-sm text-destructive">
							Library could not be loaded.
						</p>
					) : files.length === 0 ? (
						<div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
							<Library className="size-6" />
							<p className="text-sm">Your Library is empty.</p>
						</div>
					) : (
						files.map((file) => {
							const Icon = libraryFileIcon(file.name);
							const selected = selectedPaths.has(file.relativePath);
							return (
								<label
									key={file.relativePath}
									className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/60"
								>
									<input
										type="checkbox"
										className="size-4"
										checked={selected}
										onChange={(event) => {
											setSelectedPaths((current) => {
												const next = new Set(current);
												if (event.target.checked) next.add(file.relativePath);
												else next.delete(file.relativePath);
												return next;
											});
										}}
									/>
									<Icon className="size-4 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-medium">{file.name}</span>
										<span className="block truncate text-xs text-muted-foreground">
											{file.relativePath}
										</span>
									</span>
								</label>
							);
						})
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={selectedPaths.size === 0}
						onClick={() => {
							onSelect(files.filter((file) => selectedPaths.has(file.relativePath)));
							onOpenChange(false);
						}}
					>
						Add {selectedPaths.size > 0 ? selectedPaths.size : ''}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
