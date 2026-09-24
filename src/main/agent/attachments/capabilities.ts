import { AGENT_TEXT_ATTACHMENT_EXTENSIONS } from '../../../shared/agent_files';
import type { AgentPromptInputCapabilities } from '../../../shared/agent_types';
import type { PromptAttachmentRule } from '../../../shared/model_types';
import { findModel } from '../../models';

const ADAPTER_FORMATS: Readonly<Record<string, readonly PromptAttachmentRule['kind'][]>> = {
	openai: ['image', 'document'],
	anthropic: ['image', 'document'],
	reka: ['image', 'document'],
};

export function resolvePromptInputCapabilities(
	providerId: string | undefined,
	modelId: string | undefined
): AgentPromptInputCapabilities | null {
	if (!providerId?.trim() || !modelId?.trim()) return null;
	const model = findModel(providerId, 'llm', modelId);
	if (!model) return null;
	const adapterKinds = ADAPTER_FORMATS[providerId.trim().toLowerCase()] ?? ['image'];
	const declared =
		model.metadata?.documentationStatus === 'verified'
			? model.metadata.promptAttachments
			: undefined;
	const rules = (declared ?? [])
		.filter((rule) => adapterKinds.includes(rule.kind))
		.map(
			(rule): PromptAttachmentRule => ({
				...rule,
				mimeTypes: [...rule.mimeTypes],
				extensions: [...rule.extensions],
			})
		);
	const accept = [
		...AGENT_TEXT_ATTACHMENT_EXTENSIONS,
		...rules.flatMap((rule) => [...rule.mimeTypes, ...rule.extensions]),
	]
		.filter((value, index, values) => values.indexOf(value) === index)
		.join(',');
	return {
		rules,
		accept,
	};
}
