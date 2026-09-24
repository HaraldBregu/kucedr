const findModel = jest.fn();

jest.mock('../../../../src/main/models', () => ({
	findModel: (...args: unknown[]) => findModel(...args),
}));

import { resolvePromptInputCapabilities } from '../../../../src/main/agent/attachments/capabilities';
import { preflightPromptAttachments } from '../../../../src/main/agent/attachments/preflight';
import { projectPromptAttachments } from '../../../../src/main/agent/attachments/project';
import { llmToTranscriptEntry } from '../../../../src/main/models/adapters/llm/llm_shared';

const imageRule = {
	kind: 'image' as const,
	mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	extensions: ['.jpg', '.jpeg', '.png', '.webp'],
};
const documentRule = {
	kind: 'document' as const,
	mimeTypes: ['application/pdf'],
	extensions: ['.pdf'],
};

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const capabilities = {
	rules: [imageRule, documentRule],
	accept: '',
};

describe('prompt attachment capabilities', () => {
	beforeEach(() => findModel.mockReset());

	it('intersects verified model rules with adapter support and always includes local text', () => {
		findModel.mockReturnValue({
			metadata: {
				documentationStatus: 'verified',
				promptAttachments: [
					imageRule,
					documentRule,
					{ kind: 'audio', mimeTypes: ['audio/mpeg'], extensions: ['.mp3'] },
				],
			},
		});
		const result = resolvePromptInputCapabilities('google', 'gemini');
		expect(result?.rules).toEqual([expect.objectContaining(imageRule)]);
		expect(result?.accept).toContain('.ts');
		expect(result?.accept).toContain('image/png');
		expect(result?.accept).not.toContain('application/pdf');
	});

	it('fails closed for missing and unverified native metadata', () => {
		findModel.mockReturnValue({ metadata: { promptAttachments: [imageRule] } });
		expect(resolvePromptInputCapabilities('openai', 'local')?.rules).toEqual([]);
		findModel.mockReturnValue(undefined);
		expect(resolvePromptInputCapabilities('openai', 'missing')).toBeNull();
	});
});

describe('prompt attachment preflight', () => {
	it('accepts more than ten files and text above the former size limit', () => {
		const text = 'x'.repeat(120_001);
		const files = Array.from({ length: 11 }, (_, index) => ({
			name: `note-${index}.txt`,
			mimeType: 'text/plain',
			data: Buffer.from(text).toString('base64'),
		}));
		expect(preflightPromptAttachments(files, capabilities)).toHaveLength(11);
	});

	it('accepts an empty text attachment', () => {
		expect(
			preflightPromptAttachments(
				[{ name: 'empty.txt', mimeType: 'text/plain', data: '' }],
				capabilities
			)
		).toEqual([
			expect.objectContaining({ type: 'text_file', name: 'empty.txt', bytes: 0, text: '' }),
		]);
	});

	it('keeps the selected path on the stored attachment block', () => {
		expect(
			preflightPromptAttachments(
				[
					{
						name: 'note.txt',
						mimeType: 'text/plain',
						data: 'YQ==',
						path: '/tmp/note.txt',
					},
				],
				capabilities
			)[0]
		).toEqual(expect.objectContaining({ path: '/tmp/note.txt' }));
	});

	it('decodes UTF-8 text and detects native formats without trusting renderer MIME', () => {
		expect(
			preflightPromptAttachments(
				[
					{
						name: 'code.ts',
						mimeType: 'application/octet-stream',
						data: Buffer.from('const ok = true;').toString('base64'),
					},
					{ name: 'pixel.png', mimeType: 'text/plain', data: png.toString('base64') },
				],
				capabilities
			)
		).toEqual([
			expect.objectContaining({ type: 'text_file', name: 'code.ts', text: 'const ok = true;' }),
			expect.objectContaining({ type: 'image', name: 'pixel.png', mimeType: 'image/png' }),
		]);
	});

	it('rejects an unsafe name before persistence', () => {
		expect(() =>
			preflightPromptAttachments(
				[
					{
						name: '../secret.txt',
						mimeType: 'text/plain',
						data: Buffer.from('safe').toString('base64'),
					},
				],
				capabilities
			)
		).toThrow('safe basename');
	});

	it.each([
		[
			'binary text',
			{ name: 'bad.txt', mimeType: 'text/plain', data: Buffer.from([0, 1]).toString('base64') },
		],
		[
			'invalid UTF-8',
			{
				name: 'bad.txt',
				mimeType: 'text/plain',
				data: Buffer.from([0xc3, 0x28]).toString('base64'),
			},
		],
		[
			'spoofed extension',
			{ name: 'pixel.jpg', mimeType: 'image/jpeg', data: png.toString('base64') },
		],
		[
			'unknown binary',
			{
				name: 'archive.zip',
				mimeType: 'application/pdf',
				data: Buffer.from('PK\u0003\u0004').toString('base64'),
			},
		],
	] as const)('skips %s while keeping supported files', (_case, file) => {
		expect(
			preflightPromptAttachments(
				[file, { name: 'note.txt', mimeType: 'text/plain', data: 'b2s=' }],
				capabilities
			)
		).toEqual([expect.objectContaining({ type: 'text_file', name: 'note.txt', text: 'ok' })]);
	});

	it('skips native files unsupported by the model while keeping supported text', () => {
		expect(
			preflightPromptAttachments(
				[
					{ name: 'pixel.png', mimeType: 'image/png', data: png.toString('base64') },
					{ name: 'note.txt', mimeType: 'text/plain', data: 'b2s=' },
				],
				{ ...capabilities, rules: [] }
			)
		).toEqual([expect.objectContaining({ type: 'text_file', name: 'note.txt', text: 'ok' })]);
	});
});

describe('historical attachment projection', () => {
	it('keeps text and replaces unsupported native history with a metadata marker', () => {
		const result = projectPromptAttachments(
			[
				{
					role: 'user',
					content: [
						{
							type: 'text_file',
							name: 'note.txt',
							mimeType: 'text/plain',
							bytes: 5,
							text: 'hello',
						},
						{
							type: 'document',
							name: 'brief.pdf',
							mimeType: 'application/pdf',
							bytes: 20,
							base64: 'cGRm',
						},
					],
				},
			],
			{ ...capabilities, rules: [] }
		);
		expect(JSON.stringify(result)).toContain('[Complete contents of the uploaded text file]');
		expect(JSON.stringify(result)).toContain('--- BEGIN UPLOADED CONTENT ---');
		expect(JSON.stringify(result)).toContain('hello');
		expect(JSON.stringify(result)).toContain('--- END UPLOADED CONTENT ---');
		expect(JSON.stringify(result)).not.toContain('note.txt');
		expect(JSON.stringify(result)).toContain('Historical attachment unavailable');
		expect(JSON.stringify(result)).not.toContain('cGRm');
	});
});

it('passes uploaded text content—not its location—to the provider transcript', () => {
	const [file] = preflightPromptAttachments(
		[
			{
				name: 'private-notes.md',
				mimeType: 'text/markdown',
				data: Buffer.from('UNIQUE_UPLOADED_CONTENT').toString('base64'),
			},
		],
		{ ...capabilities, rules: [] }
	);
	const projected = projectPromptAttachments(
		[{ role: 'user', content: [{ type: 'text', text: 'Read the upload.' }, file] }],
		{ ...capabilities, rules: [] }
	);
	const providerTranscript = projected.flatMap(llmToTranscriptEntry);
	const serialized = JSON.stringify(providerTranscript);
	expect(serialized).toContain('UNIQUE_UPLOADED_CONTENT');
	expect(serialized).toContain('BEGIN UPLOADED CONTENT');
	expect(serialized).not.toContain('private-notes.md');
	expect(serialized).not.toContain(Buffer.from('UNIQUE_UPLOADED_CONTENT').toString('base64'));
});
