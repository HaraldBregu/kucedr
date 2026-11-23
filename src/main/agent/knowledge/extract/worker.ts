import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const task = getDocument({
	data: workerData as Uint8Array,
	disableFontFace: true,
	useSystemFonts: false,
	verbosity: 0,
});
try {
	const document = await task.promise;
	const pages: { label: string; text: string }[] = [];
	for (let number = 1; number <= document.numPages; number++) {
		const content = await (await document.getPage(number)).getTextContent();
		pages.push({
			label: `page ${number}`,
			text: content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join(''),
		});
	}
	parentPort?.postMessage({ pages });
} catch (error) {
	parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) });
} finally {
	await task.destroy();
}
