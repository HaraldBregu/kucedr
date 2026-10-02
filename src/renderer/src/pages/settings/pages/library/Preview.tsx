import React from 'react';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { libraryFileIcon } from './icon';
import { libraryFileUrl } from './url';

export function LibraryPreview({
	file,
	compact = false,
}: {
	readonly file: LibraryFile;
	readonly compact?: boolean;
}): React.JSX.Element {
	const url = libraryFileUrl(file.path);
	const Icon = libraryFileIcon(file.name);
	const frame = compact ? 'h-14 w-16 shrink-0' : 'aspect-[4/3] w-full';

	if (/\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i.test(file.name)) {
		return (
			<img
				src={url}
				alt={file.name}
				loading="lazy"
				className={`${frame} rounded-md bg-muted/40 object-contain`}
			/>
		);
	}
	if (/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
		return (
			<video
				src={url}
				controls
				preload="metadata"
				aria-label={file.name}
				className={`${frame} rounded-md bg-muted/40 object-contain`}
			/>
		);
	}
	if (/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)) {
		return (
			<div
				className={`flex items-center justify-center rounded-md bg-muted/40 ${compact ? 'min-w-0 max-w-48 flex-1' : 'aspect-[4/3] w-full flex-col gap-4 px-4'}`}
			>
				{!compact && <Icon className="size-10 text-muted-foreground" />}
				<audio
					src={url}
					controls
					preload="none"
					aria-label={file.name}
					className="h-10 w-full min-w-0"
				/>
			</div>
		);
	}
	if (/\.pdf$/i.test(file.name) && !compact) {
		return (
			<iframe
				src={url}
				title={file.name}
				loading="lazy"
				className={`${frame} rounded-md bg-muted/40`}
			/>
		);
	}
	return (
		<div
			className={`flex items-center justify-center rounded-md bg-muted/40 text-muted-foreground ${frame}`}
		>
			<Icon className={compact ? 'size-6' : 'size-12'} />
		</div>
	);
}
