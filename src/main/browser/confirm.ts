import { BrowserWindow, dialog, type MessageBoxOptions, type WebContents } from 'electron';

// A native warning the renderer cannot answer for itself; Cancel is the default button.
export async function confirmDeletion(sender: WebContents, message: string, detail: string): Promise<boolean> {
	const options: MessageBoxOptions = {
		type: 'warning',
		buttons: ['Cancel', 'Delete'],
		cancelId: 0,
		defaultId: 0,
		noLink: true,
		message,
		detail,
	};
	const window = BrowserWindow.fromWebContents(sender);
	const result = await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options));
	return result.response === 1;
}
