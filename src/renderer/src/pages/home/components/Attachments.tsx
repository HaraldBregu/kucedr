import { FileCodeIcon, FileImageIcon, FileTextIcon, TableIcon } from 'lucide-react';
import {
	Attachment,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from '@/components/ui/attachment';
import { Preview } from '../attachments/Preview';
import { formatFileSize } from '../attachments/size';
import type { UserAttachment } from '../context/state';

export function Attachments({ attachments }: { readonly attachments: readonly UserAttachment[] }): React.JSX.Element {
	const images = attachments.filter((attachment) => attachment.kind === 'image');
	const files = attachments.filter((attachment) => attachment.kind !== 'image');
	const hasMultipleImages = images.length > 1;
	const imageColumns = Math.min(images.length, 4);

	return (
		<>
			{images.length > 0 ? (
				<AttachmentGroup
					role="group"
					aria-label="Attached images"
					className={hasMultipleImages
						? 'grid max-w-full self-start gap-0 overflow-hidden! rounded-[16px] py-0'
						: 'max-w-full self-start overflow-visible! py-0'}
					style={hasMultipleImages
						? {
							width: `${imageColumns * 4}rem`,
							gridTemplateColumns: `repeat(${imageColumns}, minmax(0, 1fr))`,
						}
						: undefined}
				>
					{images.map((attachment, index) => (
						<Attachment
							key={`${attachment.name}-${index}`}
							role="group"
							aria-label={attachment.name}
							size="sm"
							className={hasMultipleImages
								? 'w-full min-w-0 overflow-hidden rounded-none border-0 has-data-[slot=attachment-media]:p-0'
								: 'max-w-full overflow-hidden rounded-[16px] border-0 has-data-[slot=attachment-media]:p-0'}
						>
							<AttachmentMedia
								variant="image"
								className={hasMultipleImages
									? 'w-full! rounded-[inherit]'
									: 'aspect-auto! w-auto! max-w-full rounded-[inherit] [&_img]:aspect-auto! [&_img]:h-auto! [&_img]:max-h-[28rem] [&_img]:max-w-full [&_img]:object-contain!'}
							>
								{attachment.file || attachment.path ? <Preview file={attachment.file} path={attachment.path} name={attachment.name} mimeType={attachment.mimeType} /> : <FileImageIcon />}
							</AttachmentMedia>
						</Attachment>
					))}
				</AttachmentGroup>
			) : null}
			{files.length > 0 ? (
				<AttachmentGroup
					role="list"
					aria-label="Attached files"
					className="ml-auto w-64 max-w-full flex-col gap-2 overflow-x-visible!"
				>
					{files.map((attachment, index) => {
						const Icon = /\.(csv|xlsx?|ods)$/i.test(attachment.name)
							? TableIcon
							: /\.(jsx?|tsx?|json|html|css|py|sh)$/i.test(attachment.name)
								? FileCodeIcon
								: FileTextIcon;
						return (
							<Attachment
								key={`${attachment.name}-${index}`}
								role="listitem"
								size="sm"
								className="w-full rounded-[16px] has-data-[slot=attachment-content]:px-3 has-data-[slot=attachment-content]:py-2.5 has-data-[slot=attachment-media]:p-2.5"
							>
								<AttachmentMedia><Icon /></AttachmentMedia>
								<AttachmentContent>
									<AttachmentTitle title={attachment.name}>{attachment.name}</AttachmentTitle>
									<AttachmentDescription>
										{attachment.name.split('.').pop()?.toUpperCase() ?? 'FILE'} · {formatFileSize(attachment.bytes)}
									</AttachmentDescription>
								</AttachmentContent>
							</Attachment>
						);
					})}
				</AttachmentGroup>
			) : null}
		</>
	);
}
