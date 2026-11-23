import unzipper from 'unzipper';
import type { RagSegment } from '../rag/types';
import { decodeEntities } from './entities';
import { markupText } from './markup';

const PART_LIMIT = 64 * 1024 * 1024;

export async function officeText(bytes: Buffer, extension: string): Promise<RagSegment[]> {
	const archive = await unzipper.Open.buffer(bytes);
	const read = async (name: string): Promise<string> => {
		const entry = archive.files.find((file) => file.path === name);
		if (!entry) return '';
		const chunks: Buffer[] = [];
		let size = 0;
		for await (const chunk of entry.stream()) {
			size += (chunk as Buffer).length;
			if (size > PART_LIMIT) throw new Error('Document part is too large.');
			chunks.push(chunk as Buffer);
		}
		return Buffer.concat(chunks).toString('utf8');
	};
	const attribute = (tag: string, name: string): string =>
		decodeEntities(new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? '');

	if (extension === '.docx') {
		const xml = (await read('word/document.xml'))
			.replace(/<w:(instrText|delText)\b[^>]*>[\s\S]*?<\/w:\1>/g, '')
			.replace(/<w:tab\b[^>]*\/>/g, '\t');
		return [{ text: markupText(xml, /<\/w:p>|<w:br\b[^>]*\/>/g) }];
	}
	if (extension === '.pptx') {
		const slides = archive.files
			.map((file) => ({ path: file.path, number: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(file.path)?.[1]) }))
			.filter((slide) => slide.number > 0)
			.sort((left, right) => left.number - right.number);
		const segments: RagSegment[] = [];
		for (const slide of slides)
			segments.push({
				label: `slide ${slide.number}`,
				text: markupText(await read(slide.path), /<\/a:p>|<a:br\b[^>]*\/>/g),
			});
		return segments;
	}
	if (extension === '.xlsx') {
		const shared = [...(await read('xl/sharedStrings.xml')).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(
			(item) =>
				decodeEntities(
					[...item[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
						.map((text) => text[1])
						.join('')
				)
		);
		const targets = new Map(
			[...(await read('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b[^>]*>/g)].map((tag) => {
				const target = attribute(tag[0], 'Target');
				return [attribute(tag[0], 'Id'), target.startsWith('/') ? target.slice(1) : `xl/${target}`];
			})
		);
		const segments: RagSegment[] = [];
		for (const sheet of (await read('xl/workbook.xml')).matchAll(/<sheet\b[^>]*>/g)) {
			const target = targets.get(attribute(sheet[0], 'r:id'));
			if (!target) continue;
			const rows = [...(await read(target)).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
				[...row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
					.map(([, attributes, body = '']) => {
						const type = attribute(attributes, 't');
						if (type === 'inlineStr') return markupText(body, /<\/t>/g).replace(/\n/g, ' ');
						const value = decodeEntities(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
						return type === 's' ? (shared[Number(value)] ?? '') : value;
					})
					.filter(Boolean)
					.join('\t')
			);
			segments.push({ label: `sheet ${attribute(sheet[0], 'name')}`, text: rows.filter(Boolean).join('\n') });
		}
		return segments;
	}
	const xml = (await read('content.xml')).replace(/<text:s\b[^>]*\/>/g, ' ').replace(/<text:tab\b[^>]*\/>/g, '\t');
	return [
		{
			text: markupText(
				xml,
				/<\/text:(p|h)>|<text:line-break\b[^>]*\/>|<\/table:table-row>/g,
				/<\/table:table-cell>/g
			),
		},
	];
}
