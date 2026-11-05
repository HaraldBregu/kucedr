import type { ReactElement } from 'react';
import {
	FileAudioIcon,
	FileCodeIcon,
	FileImageIcon,
	FileTextIcon,
	TableIcon,
	X,
} from 'lucide-react';
import { AudioPlayer } from '@/components/audio-player';
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from '@/components/ui/attachment';
import { cn } from '@/lib/utils';
import { Preview } from '../attachments/Preview';
import { formatFileSize } from '../attachments/size';
import type { PromptAttachment } from '../attachments/types';

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return hours > 0
		? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
		: `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function AttachmentTray({
	attachments,
	onRemove,
}: {
	readonly attachments: readonly PromptAttachment[];
	readonly onRemove: (id: string) => void;
}): ReactElement | null {
	if (attachments.length === 0) return null;

	return (
		<AttachmentGroup className="w-full" onClick={(event) => event.stopPropagation()}>
			{attachments.map((attachment) => {
				const isAudio = attachment.kind === 'audio';
				const title = isAudio
					? `Audio ${formatDuration(attachment.durationMs ?? 0)}`
					: attachment.file.name;
				const extension = attachment.file.name.split('.').pop()?.toUpperCase() ?? 'FILE';
				const isImage = attachment.file.type.startsWith('image/');
				const Icon =
					isAudio || attachment.file.type.startsWith('audio/')
						? FileAudioIcon
						: isImage
							? FileImageIcon
							: /\.(csv|xlsx?|ods)$/i.test(attachment.file.name)
								? TableIcon
								: /\.(jsx?|tsx?|json|html|css|py|sh)$/i.test(attachment.file.name)
									? FileCodeIcon
									: FileTextIcon;

				return (
					<Attachment
						key={attachment.id}
						size="sm"
						className={cn(
							'rounded-[16px] has-data-[slot=attachment-content]:px-3 has-data-[slot=attachment-content]:py-2.5 has-data-[slot=attachment-media]:p-2.5',
							isAudio ? 'w-80' : 'w-64'
						)}
					>
						<AttachmentMedia variant={isImage ? 'image' : 'icon'}>
							{isImage ? (
								<Preview
									file={attachment.file}
									path={attachment.path}
									name={attachment.file.name}
									mimeType={attachment.file.type}
								/>
							) : (
								<Icon />
							)}
						</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle title={title}>{title}</AttachmentTitle>
							<AttachmentDescription>
								{extension} · {formatFileSize(attachment.file.size)}
							</AttachmentDescription>
						</AttachmentContent>
						<AttachmentActions>
							<AttachmentAction
								type="button"
								aria-label={`Remove ${title}`}
								onClick={() => onRemove(attachment.id)}
							>
								<X className="size-3.5" />
							</AttachmentAction>
						</AttachmentActions>
						{isAudio && attachment.url ? (
							<AudioPlayer
								src={attachment.url}
								className="basis-full border-0 bg-transparent px-1 py-1"
							/>
						) : null}
					</Attachment>
				);
			})}
		</AttachmentGroup>
	);
}
