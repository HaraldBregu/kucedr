import { File, Folder } from 'lucide-react';
import type { DriveFile } from '@shared/drive_types';
import { cn } from '@/lib/utils';

interface DriveFilesProps {
	readonly files: DriveFile[];
	readonly selectedId: string | null;
	readonly loading: boolean;
	readonly onSelect: (file: DriveFile) => void;
}

export function DriveFiles({
	files,
	selectedId,
	loading,
	onSelect,
}: DriveFilesProps): React.JSX.Element {
	return (
		<nav aria-label="Drive files" className="min-h-0 flex-1 overflow-y-auto p-2">
			{loading ? (
				<p className="px-2 py-3 text-sm text-muted-foreground">Loading files…</p>
			) : files.length === 0 ? (
				<p className="px-2 py-3 text-sm text-muted-foreground">No files found.</p>
			) : (
				<ul className="space-y-1">
					{files.map((file) => (
						<li key={file.id}>
							<button
								type="button"
								aria-current={selectedId === file.id ? 'page' : undefined}
								onClick={() => onSelect(file)}
								className={cn(
									'flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
									selectedId === file.id && 'bg-sidebar-accent font-medium'
								)}
							>
								{file.mimeType === 'application/vnd.google-apps.folder' ? (
									<Folder className="size-4 shrink-0" />
								) : (
									<File className="size-4 shrink-0 text-muted-foreground" />
								)}
								<span className="min-w-0 flex-1 truncate" title={file.name}>
									{file.name}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</nav>
	);
}
