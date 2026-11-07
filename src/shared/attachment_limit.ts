import type { PromptAttachmentRule } from './model_types';

export function attachmentLimitError(
	files: readonly { readonly name: string; readonly size: number }[],
	rules: readonly PromptAttachmentRule[]
): string | undefined {
	const megabytes = (bytes: number): string => `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
	for (const rule of rules) {
		const matched = files.filter((file) =>
			rule.extensions.includes(file.name.slice(file.name.lastIndexOf('.')).toLowerCase())
		);
		const large = matched.find((file) => rule.maxBytes !== undefined && file.size > rule.maxBytes);
		if (large && rule.maxBytes !== undefined)
			return `${large.name} exceeds the ${megabytes(rule.maxBytes)} ${rule.kind} limit for this model.`;
		if (rule.maxFiles !== undefined && matched.length > rule.maxFiles)
			return `This model accepts at most ${rule.maxFiles} ${rule.kind} attachments.`;
		const total = matched.reduce((sum, file) => sum + file.size, 0);
		if (rule.maxTotalBytes !== undefined && total > rule.maxTotalBytes)
			return `${rule.kind} attachments exceed the ${megabytes(rule.maxTotalBytes)} total limit for this model.`;
	}
	return undefined;
}
