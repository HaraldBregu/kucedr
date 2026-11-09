import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';

export async function exportDocument(name: string, format: 'md' | 'html' | 'pdf', content: string): Promise<boolean> {
	const result = await dialog.showSaveDialog({ defaultPath: `${name}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
	if (result.canceled || !result.filePath) return false;
	if (format !== 'pdf') {
		await writeFile(result.filePath, content);
		return true;
	}
	const window = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
	try {
		await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
		await writeFile(result.filePath, await window.webContents.printToPDF({ printBackground: true }));
	} finally {
		window.destroy();
	}
	return true;
}
