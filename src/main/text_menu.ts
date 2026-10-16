import { Menu, type MenuItemConstructorOptions, type WebContents } from 'electron';

export function attachTextMenu(webContents: WebContents): void {
	webContents.on('context-menu', (_event, params) => {
		const hasSelection = params.selectionText.trim().length > 0;
		const template: MenuItemConstructorOptions[] = params.isEditable
			? [
					{ role: 'undo', enabled: params.editFlags.canUndo },
					{ role: 'redo', enabled: params.editFlags.canRedo },
					{ type: 'separator' },
					{ role: 'cut', enabled: params.editFlags.canCut },
					{ role: 'copy', enabled: params.editFlags.canCopy },
					{ role: 'paste', enabled: params.editFlags.canPaste },
					{ type: 'separator' },
					{ role: 'selectAll', enabled: params.editFlags.canSelectAll },
				]
			: hasSelection
				? [{ role: 'copy' }, { type: 'separator' }, { role: 'selectAll' }]
				: [];
		if (template.length) Menu.buildFromTemplate(template).popup();
	});
}
