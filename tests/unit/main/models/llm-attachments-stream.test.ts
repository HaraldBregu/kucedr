import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';
import type { LlmRequest } from '../../../../src/main/models/adapters/llm/llm_types';

const request = (providerId: string, model = 'model'): LlmRequest => ({
	provider: { id: providerId, apiKey: 'key' },
	model,
	messages: [
		{
			role: 'user',
			content: [
				{
					type: 'document',
					name: 'brief.pdf',
					mimeType: 'application/pdf',
					base64: 'cGRm',
				},
			],
		},
	],
	maxTokens: 100,
	streaming: true,
});

const imageRequest = (providerId: string): LlmRequest => ({
	...request(providerId),
	messages: [
		{
			role: 'user',
			content: [{ type: 'image', mimeType: 'image/png', base64: 'aW1hZ2U=' }],
		},
	],
});

function emptyStream(): AsyncIterable<never> {
	return {
		[Symbol.asyncIterator]: () => ({
			next: async () => ({ done: true, value: undefined as never }),
		}),
	};
}

describe('LLM streaming attachment payloads', () => {
	it('uses OpenAI Responses image and PDF payloads', async () => {
		const create = jest.fn().mockResolvedValue(emptyStream());
		const model = new LlmModel({
			openAIClientFactory: () => ({ responses: { create } }) as never,
		});
		const openAIRequest = request('openai', 'gpt-5.4');
		openAIRequest.messages[0].content = [
			{ type: 'image', mimeType: 'image/png', base64: 'aW1hZ2U=' },
			{
				type: 'document',
				name: 'brief.pdf',
				mimeType: 'application/pdf',
				base64: 'cGRm',
			},
		];
		for await (const _event of model.stream(openAIRequest)) {
			// Consume the provider stream.
		}

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				stream: true,
				input: [
					{
						role: 'user',
						content: [
							{
								type: 'input_image',
								image_url: 'data:image/png;base64,aW1hZ2U=',
								detail: 'auto',
							},
							{
								type: 'input_file',
								filename: 'brief.pdf',
								file_data: 'data:application/pdf;base64,cGRm',
							},
						],
					},
				],
			}),
			expect.objectContaining({ signal: undefined })
		);
	});

	it('uses Anthropic image and PDF payloads', async () => {
		const stream = jest.fn().mockReturnValue(emptyStream());
		const model = new LlmModel({
			anthropicClientFactory: () => ({ messages: { stream } }) as never,
		});
		const anthropicRequest = request('anthropic');
		anthropicRequest.messages[0].content = [
			{ type: 'image', mimeType: 'image/png', base64: 'aW1hZ2U=' },
			{
				type: 'document',
				name: 'brief.pdf',
				mimeType: 'application/pdf',
				base64: 'cGRm',
			},
		];
		for await (const _event of model.stream(anthropicRequest)) {
			// Consume the provider stream.
		}

		expect(stream).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'image',
								source: {
									type: 'base64',
									media_type: 'image/png',
									data: 'aW1hZ2U=',
								},
							},
							{
								type: 'document',
								source: {
									type: 'base64',
									media_type: 'application/pdf',
									data: 'cGRm',
								},
							},
						],
					},
				],
			}),
			expect.objectContaining({ signal: undefined })
		);
	});

	it('uses image_url for generic compatible streaming requests', async () => {
		const create = jest.fn().mockResolvedValue(emptyStream());
		const model = new LlmModel({
			openAIClientFactory: () => ({ chat: { completions: { create } } }) as never,
		});
		for await (const _event of model.stream(imageRequest('compatible'))) {
			// Consume the provider stream.
		}

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				stream: true,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'image_url',
								image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
							},
						],
					},
				],
			}),
			expect.objectContaining({ signal: undefined })
		);
	});

	it('uses the targeted Reka PDF payload for streaming requests', async () => {
		const create = jest.fn().mockResolvedValue(emptyStream());
		const model = new LlmModel({
			openAIClientFactory: () => ({ chat: { completions: { create } } }) as never,
		});
		for await (const _event of model.stream(request('reka'))) {
			// Consume the provider stream.
		}

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				stream: true,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'pdf_url',
								pdf_url: { url: 'data:application/pdf;base64,cGRm' },
							},
						],
					},
				],
			}),
			expect.objectContaining({ signal: undefined })
		);
	});

	it('rejects generic chat PDF blocks before a streaming network request', async () => {
		const create = jest.fn();
		const model = new LlmModel({
			openAIClientFactory: () => ({ chat: { completions: { create } } }) as never,
		});

		await expect(async () => {
			for await (const _event of model.stream(request('compatible'))) {
				// Consume the provider stream.
			}
		}).rejects.toThrow('brief.pdf: this chat adapter does not support document attachments.');
		expect(create).not.toHaveBeenCalled();
	});
});
