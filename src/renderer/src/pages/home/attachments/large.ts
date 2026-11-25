import type { PromptAttachmentRule } from '@shared/model_types';
import i18next from 'i18next';
import { formatFileSize } from './size';

const MAX_BYTES = 5 * 1024 * 1024;

export function largeAttachmentError(
	files: readonly File[],
	rules: readonly PromptAttachmentRule[]
): string | undefined {
	const large = files.find((file) => {
		const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
		return (
			file.size > MAX_BYTES &&
			!rules.some((rule) => rule.maxBytes !== undefined && rule.extensions.includes(extension))
		);
	});
	return large
		? i18next.t('attachments.tooLarge', { name: large.name, size: formatFileSize(MAX_BYTES) })
		: undefined;
}
