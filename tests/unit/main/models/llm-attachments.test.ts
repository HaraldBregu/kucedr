import {
	llmBuildAnthropicMessages,
	llmBuildChatMessages,
	llmBuildResponseInput,
	llmToTranscriptEntry,
} from '../../../../src/main/models/adapters/llm/llm_shared';
import type { LlmTranscriptEntry } from '../../../../src/main/models/adapters/llm/llm_types';

const image = { type: 'image' as const, mimeType: 'image/webp', base64: 'aW1hZ2U=' };
const pdf = {
	type: 'document' as const,
	name: 'brief.pdf',
	mimeType: 'application/pdf' as const,
	base64: 'cGRm',
};
const transcript = (block: typeof image | typeof pdf): LlmTranscriptEntry[] => [
	{ role: 'user', content: [block] },
];

describe('LLM attachment payload builders', () => {
	it('serializes explicit image and PDF blocks for OpenAI Responses', () => {
		expect(llmBuildResponseInput([{ role: 'user', content: [image, pdf] }])).toEqual([
			{
				role: 'user',
				content: [
					{
						type: 'input_image',
						image_url: 'data:image/webp;base64,aW1hZ2U=',
						detail: 'auto',
					},
					{
						type: 'input_file',
						filename: 'brief.pdf',
						file_data: 'data:application/pdf;base64,cGRm',
					},
				],
			},
		]);
	});

	it('serializes Anthropic images and PDFs with their verified MIME types', () => {
		expect(llmBuildAnthropicMessages([{ role: 'user', content: [image, pdf] }])).toEqual([
			{
				role: 'user',
				content: [
					{
						type: 'image',
						source: { type: 'base64', media_type: 'image/webp', data: 'aW1hZ2U=' },
					},
					{
						type: 'document',
						source: { type: 'base64', media_type: 'application/pdf', data: 'cGRm' },
					},
				],
			},
		]);
	});

	it('allows image_url but rejects documents for generic compatible chat', () => {
		expect(llmBuildChatMessages('', transcript(image))).toEqual([
			{
				role: 'user',
				content: [
					{
						type: 'image_url',
						image_url: { url: 'data:image/webp;base64,aW1hZ2U=' },
					},
				],
			},
		]);
		expect(() => llmBuildChatMessages('', transcript(pdf))).toThrow(
			'brief.pdf: this chat adapter does not support document attachments.'
		);
	});

	it('uses Reka pdf_url only for the targeted chat profile', () => {
		expect(llmBuildChatMessages('', transcript(pdf), { contentProfile: 'reka' })).toEqual([
			{
				role: 'user',
				content: [
					{
						type: 'pdf_url',
						pdf_url: { url: 'data:application/pdf;base64,cGRm' },
					},
				],
			},
		]);
	});

	it('rejects unsupported image MIME types instead of silently coercing them', () => {
		const tiff = { type: 'image' as const, mimeType: 'image/tiff', base64: 'SUkq' };
		expect(() => llmBuildResponseInput(transcript(tiff as typeof image))).toThrow(
			'unsupported image MIME type image/tiff'
		);
		expect(() => llmBuildAnthropicMessages(transcript(tiff as typeof image))).toThrow(
			'unsupported image MIME type image/tiff'
		);
		expect(() => llmBuildChatMessages('', transcript(tiff as typeof image))).toThrow(
			'unsupported image MIME type image/tiff'
		);
	});

	it('keeps local text files as separate labeled user text blocks', () => {
		expect(
			llmToTranscriptEntry({
				role: 'user',
				content: [
					{ type: 'text', text: 'Review this file.' },
					{
						type: 'text_file',
						name: 'config.toml',
						mimeType: 'text/plain',
						bytes: 8,
						text: 'enabled=true',
					},
				],
			})
		).toEqual([
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Review this file.' },
					{
						type: 'text',
						text: [
							'[Complete contents of the uploaded text file]',
							'--- BEGIN UPLOADED CONTENT ---',
							'enabled=true',
							'--- END UPLOADED CONTENT ---',
						].join('\n'),
					},
				],
			},
		]);
		expect(
			JSON.stringify(
				llmToTranscriptEntry({
					role: 'user',
					content: [
						{
							type: 'text_file',
							name: 'config.toml',
							mimeType: 'text/plain',
							bytes: 8,
							text: 'enabled=true',
						},
					],
				})
			)
		).not.toContain('config.toml');
	});

	it('rejects unknown semantic blocks instead of silently dropping them', () => {
		expect(() =>
			llmToTranscriptEntry({
				role: 'user',
				content: [{ type: 'audio', mimeType: 'audio/mpeg', base64: 'YXVkaW8=' }],
			})
		).toThrow('Unsupported user content block: audio.');
	});
});
