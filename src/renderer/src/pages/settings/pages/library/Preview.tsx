import React from 'react';
import { Folder } from 'lucide-react';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { libraryFileIcon } from './icon';
import { libraryFileUrl } from './url';

export function LibraryPreview({
	file,
	compact = false,
	modal = false,
}: {
	readonly file: LibraryFile;
	readonly compact?: boolean;
	readonly modal?: boolean;
}): React.JSX.Element {
	const url = libraryFileUrl(file.path);
	const frame = modal
		? 'h-[min(70vh,700px)] w-full'
		: compact
			? 'size-8 shrink-0'
			: 'aspect-[4/3] w-full';
	if (file.kind === 'folder') {
		return <div className={`flex items-center justify-center rounded-md bg-muted/40 text-muted-foreground ${frame}`}><Folder className={compact ? 'size-4' : 'size-12'} /></div>;
	}

	if (/\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i.test(file.name)) {
		return (
			<img
				src={url}
				alt={file.name}
				loading="lazy"
				className={`${frame} rounded-md bg-muted/40 ${compact ? 'object-cover' : 'object-contain'}`}
			/>
		);
	}
	if (/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
		return (
			<video
				src={url}
				controls={modal}
				preload="metadata"
				aria-label={file.name}
				className={`${frame} rounded-md bg-muted/40 ${compact ? 'object-cover' : 'object-contain'}`}
			/>
		);
	}
	if (/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)) {
		if (!modal) {
			return (
				<div
					className={`flex items-center justify-center rounded-md bg-muted/40 text-muted-foreground ${frame}`}
				>
					{React.createElement(libraryFileIcon(file.name), {
						className: compact ? 'size-4' : 'size-12',
					})}
				</div>
			);
		}
		return (
			<div className="flex h-48 w-full flex-col items-center justify-center gap-4 rounded-md bg-muted/40 px-4">
				{React.createElement(libraryFileIcon(file.name), {
					className: 'size-10 text-muted-foreground',
				})}
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
	if (/\.pdf$/i.test(file.name) && modal) {
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
			{React.createElement(libraryFileIcon(file.name), {
				className: compact ? 'size-4' : 'size-12',
			})}
		</div>
	);
}
