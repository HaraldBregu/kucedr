import type { WorkspaceTreeEntry } from '@kucedr/sdk';
import { formatFileSize } from '../lib/size';

interface FileInformationProps {
	file: WorkspaceTreeEntry | null;
}

export function FileInformation({ file }: FileInformationProps) {
	const createdAt = file?.createdAt
		? new Date(file.createdAt).toLocaleString(undefined, {
				dateStyle: 'medium',
				timeStyle: 'short',
			})
		: '';
	const updatedAt = file?.updatedAt
		? new Date(file.updatedAt).toLocaleString(undefined, {
				dateStyle: 'medium',
				timeStyle: 'short',
			})
		: '';

	return (
		<div
			data-slot="file-information"
			className="flex min-w-0 flex-1 self-center flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground"
		>
			{typeof file?.size === 'number' ? <span>{formatFileSize(file.size)}</span> : null}
			{file?.createdAt ? (
				<time dateTime={file.createdAt} title={createdAt}>
					Created {createdAt}
				</time>
			) : null}
			{file?.updatedAt ? (
				<time dateTime={file.updatedAt} title={updatedAt}>
					Updated {updatedAt}
				</time>
			) : null}
		</div>
	);
}
