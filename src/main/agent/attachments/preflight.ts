import path from 'node:path';
import { AGENT_TEXT_ATTACHMENT_EXTENSIONS } from '../../../shared/agent_files';
import type { AgentInputFile, AgentPromptInputCapabilities } from '../../../shared/agent_types';
import type { PromptAttachmentBlock } from './types';

const IMAGE_FORMATS = [
	{
		mimeType: 'image/jpeg',
		extensions: ['.jpg', '.jpeg'],
		matches: (bytes: Buffer) =>
			bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
	},
	{
		mimeType: 'image/png',
		extensions: ['.png'],
		matches: (bytes: Buffer) =>
			bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
	},
	{
		mimeType: 'image/webp',
		extensions: ['.webp'],
		matches: (bytes: Buffer) =>
			bytes.length >= 12 &&
			bytes.toString('ascii', 0, 4) === 'RIFF' &&
			bytes.toString('ascii', 8, 12) === 'WEBP',
	},
] as const;

export function preflightPromptAttachments(
	files: readonly AgentInputFile[],
	capabilities: AgentPromptInputCapabilities
): PromptAttachmentBlock[] {
	return files.map((file) => {
		if (
			!file.name ||
			file.name !== path.basename(file.name) ||
			file.name.split('').some((character) => {
				const code = character.charCodeAt(0);
				return character === '/' || character === '\\' || code < 0x20 || code === 0x7f;
			})
		)
			throw new Error(`Attachment "${file.name || 'unnamed'}" must use a safe basename.`);
		const extension = path.extname(file.name).toLowerCase();
		const data = file.data.trim();
		if (data.length % 4 === 1 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(data))
			throw new Error(`Attachment "${file.name}" contains invalid base64 data.`);
		const bytes = Buffer.from(data, 'base64');
		const canonical = bytes.toString('base64').replace(/=+$/, '');
		if (canonical !== data.replace(/=+$/, ''))
			throw new Error(`Attachment "${file.name}" contains invalid base64 data.`);

		const image = IMAGE_FORMATS.find((format) => format.matches(bytes));
		const pdf = bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-';
		if (image || pdf) {
			const kind = image ? 'image' : 'document';
			const mimeType = image?.mimeType ?? 'application/pdf';
			const compatibleExtensions = image?.extensions ?? ['.pdf'];
			if (!(compatibleExtensions as readonly string[]).includes(extension))
				throw new Error(
					`Attachment "${file.name}" does not match its detected ${mimeType} format.`
				);
			const rule = capabilities.rules.find(
				(candidate) =>
					candidate.kind === kind &&
					candidate.mimeTypes.includes(mimeType) &&
					candidate.extensions.includes(extension)
			);
			if (!rule)
				throw new Error(`Attachment "${file.name}" is not supported by the selected model.`);
			return image
				? { type: 'image', name: file.name, mimeType, bytes: bytes.length, base64: data }
				: {
						type: 'document',
						name: file.name,
						mimeType: 'application/pdf',
						bytes: bytes.length,
						base64: data,
					};
		}

		if (!(AGENT_TEXT_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension))
			throw new Error(`Attachment "${file.name}" has an unsupported file type.`);
		if (
			bytes.some(
				(byte) => (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) || byte === 0x7f
			)
		)
			throw new Error(
				`Attachment "${file.name}" contains binary control bytes and is not valid text.`
			);
		let text: string;
		try {
			text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		} catch {
			throw new Error(`Attachment "${file.name}" is not valid UTF-8 text.`);
		}
		return {
			type: 'text_file',
			name: file.name,
			mimeType: 'text/plain',
			bytes: bytes.length,
			text,
		};
	});
}
