import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const testRoot = path.join(os.tmpdir(), `kucedr-browser-output-${process.pid}`);
const libraryDir = path.join(testRoot, 'library');
const workspace = path.join(testRoot, 'workspace');
const launchPersistentContext = jest.fn();

jest.mock('playwright-core', () => ({ chromium: { launchPersistentContext } }));
jest.mock('../../../../../src/main/shared/agent_location', () => ({
	agentLocation: () => workspace,
}));
jest.mock('../../../../../src/main/shared/library_location', () => ({
	libraryLocation: () => libraryDir,
}));

import { createBackgroundBrowser } from '../../../../../src/main/agent/tools/web/browser/background';

beforeEach(async () => {
	await fs.rm(testRoot, { recursive: true, force: true });
});
afterAll(async () => {
	await fs.rm(testRoot, { recursive: true, force: true });
});

it.each(['screenshot', 'pdf'] as const)(
	'saves browser %s exports in Library and requested folders',
	async (action) => {
		const screenshot = jest.fn(async () => Buffer.from('pixels'));
		const page = Object.assign(new EventEmitter(), {
			screenshot,
			locator: jest.fn(() => ({ screenshot })),
			pdf: jest.fn(async () => Buffer.from('document')),
			close: jest.fn(async () => undefined),
		});
		const context = Object.assign(new EventEmitter(), {
			pages: () => [page],
			setDefaultTimeout: jest.fn(),
			close: jest.fn(async () => undefined),
		});
		launchPersistentContext.mockResolvedValue(context);
		const browser = createBackgroundBrowser();
		try {
			await browser.tool.run({ action: 'start' });
			for (const directory of [undefined, 'captures', path.join(testRoot, 'Chosen # 雨')]) {
				const result = JSON.parse(String(await browser.tool.run({ action, directory })));
				expect(path.dirname(result.path)).toBe(
					directory === undefined ? libraryDir : path.resolve(workspace, directory)
				);
				expect(path.extname(result.path)).toBe(action === 'pdf' ? '.pdf' : '.png');
				await expect(fs.readFile(result.path, 'utf8')).resolves.toBe(
					action === 'pdf' ? 'document' : 'pixels'
				);
			}
			if (action === 'screenshot') {
				const result = JSON.parse(String(await browser.tool.run({ action, ref: 'e1' })));
				expect(page.locator).toHaveBeenCalledWith('[data-agent-ref="e1"]');
				await expect(fs.readFile(result.path, 'utf8')).resolves.toBe('pixels');
			}
		} finally {
			await browser.close();
		}
	}
);
