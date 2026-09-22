import { clipboard, Menu } from 'electron';
import type { BrowserWindow, ContextMenuParams, MenuItemConstructorOptions } from 'electron';

import { setupPdfContextMenu } from '../../../src/main/pdf';

it('shows a native context menu inside workspace PDF frames', () => {
	let contextMenu: ((event: unknown, params: ContextMenuParams) => void) | undefined;
	const window = {
		webContents: {
			on: jest.fn((event, listener) => {
				if (event === 'context-menu') contextMenu = listener;
			}),
		},
	} as unknown as BrowserWindow;
	const popup = jest.fn();
	let template: MenuItemConstructorOptions[] = [];
	(Menu.buildFromTemplate as jest.Mock).mockImplementation((items) => {
		template = items;
		return { popup };
	});

	setupPdfContextMenu(window);
	contextMenu?.({} as never, {
		frameURL: 'local-resource://agent/reports/annual%20report.pdf',
		selectionText: 'Selected text',
	} as ContextMenuParams);

	expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(1);
	expect(template[0]).toMatchObject({ role: 'copy', enabled: true });
	expect(popup).toHaveBeenCalledWith({ window });
	template[3].click?.({} as never, {} as never, {} as never);
	expect(clipboard.writeText).toHaveBeenCalledWith('reports/annual report.pdf');
});
