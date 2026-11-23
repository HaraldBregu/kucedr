import { isUtf8 } from 'node:buffer';
import path from 'node:path';
import type { RagSkipReason } from '../../../../shared/rag_status';
import type { RagSegment } from '../rag/types';
import { htmlText } from './html';
import { officeText } from './office';

const OFFICE = new Set(['.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp']);
const HTML = new Set(['.html', '.htm', '.xhtml']);

export async function extractText(
	file: string,
	bytes: Buffer,
	signal?: AbortSignal
): Promise<RagSegment[] | RagSkipReason> {
	const extension = path.extname(file).toLowerCase();
	try {
		if (extension === '.pdf') {
			const { pdfText } = await import('./pdf');
			return await pdfText(bytes, signal);
		}
		if (OFFICE.has(extension)) return await officeText(bytes, extension);
		if (extension === '.rtf' || bytes.includes(0) || !isUtf8(bytes)) return 'unsupported';
		const text = bytes.toString('utf8');
		return [{ text: HTML.has(extension) ? htmlText(text) : text }];
	} catch {
		signal?.throwIfAborted();
		return 'unreadable';
	}
}
