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

	return (
		<>
			{images.length > 0 ? (
				<AttachmentGroup
					role="group"
					aria-label="Attached images"
					className="grid w-[min(12rem,100%)] grid-cols-4 gap-0 overflow-hidden! rounded-[16px] py-0"
				>
					{images.map((attachment, index) => (
						<Attachment
							key={`${attachment.name}-${index}`}
							role="group"
							aria-label={attachment.name}
							size="sm"
							className="w-full min-w-0 overflow-hidden rounded-none border-0 has-data-[slot=attachment-media]:p-0"
						>
							<AttachmentMedia variant="image" className="w-full! rounded-[inherit]">
								{attachment.file ? <Preview file={attachment.file} /> : <FileImageIcon />}
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
