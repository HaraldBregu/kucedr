import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsUploadProps {
	readonly title: string;
	readonly description: string;
	readonly busy: boolean;
	readonly busyLabel: string;
	readonly onUpload: (paths?: string[]) => void;
}

/** Click to browse, or drop files and folders to upload them by path. */
export function SettingsUpload({
	title,
	description,
	busy,
	busyLabel,
	onUpload,
}: SettingsUploadProps): React.JSX.Element {
	const [dragging, setDragging] = useState(false);

	return (
		<button
			type="button"
			disabled={busy}
			onClick={() => onUpload()}
			onDragOver={(event) => {
				event.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(event) => {
				event.preventDefault();
				setDragging(false);
				const paths = Array.from(event.dataTransfer.files).map((file) =>
					window.app.getPathForFile(file)
				);
				if (paths.length > 0) onUpload(paths);
			}}
			className={cn(
				'flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
				dragging && 'border-primary bg-muted/50'
			)}
		>
			<div className="flex size-10 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
				<Upload className="size-5" aria-hidden="true" />
			</div>
			<span className="text-sm font-medium">{busy ? busyLabel : title}</span>
			<span className="text-xs text-muted-foreground">{description}</span>
		</button>
	);
}
