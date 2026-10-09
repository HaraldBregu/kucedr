import type { LlmStreamRequest } from './llm_types';

export function options(provider: string, request: LlmStreamRequest): Record<string, unknown> {
	const configured = { ...request.options };
	if (!request.effort) return configured;
	if (provider === 'anthropic' && /^claude-(?:fable-5-1|opus-5-5|sonnet-5-5|haiku-5-5|opus-4-8)$/.test(request.model)) {
		const output = configured.output_config as Record<string, unknown> | undefined;
		configured.output_config = { ...output, effort: request.effort === 'none' || request.effort === 'minimal' ? 'low' : request.effort };
	} else if (provider === 'xai' && request.model === 'grok-4.7') {
		configured.reasoning_effort = request.effort === 'none' || request.effort === 'minimal' ? 'low' : request.effort;
	} else if (provider === 'zai' && /^glm-5\.3/.test(request.model)) {
		configured.thinking = { ...(configured.thinking as Record<string, unknown> | undefined), type: 'enabled' };
		configured.reasoning_effort = request.effort === 'none' || request.effort === 'minimal' || request.effort === 'low' ? 'low' : request.effort === 'medium' || request.effort === 'high' ? 'high' : 'max';
	}
	return configured;
}
