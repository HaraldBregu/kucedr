import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(dirname, '../..');

/**
 * Launch the built Electron app and return the app handle plus its first window.
 * Requires a prior `npm run build` so that out/main, out/preload and out/renderer exist.
 */
export async function launchApp(extraArgs: string[] = []): Promise<{
	app: ElectronApplication;
	page: Page;
	userDataDir: string;
}> {
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'kucedr-e2e-'));
	let app: ElectronApplication | undefined;
	try {
		app = await electron.launch({
			args: [`--user-data-dir=${userDataDir}`, APP_ROOT, ...extraArgs],
			// ponytail: force production renderer (loadFile) even if a dev URL leaked into env
			env: {
				...process.env,
				NODE_ENV: 'production',
				ELECTRON_RENDERER_URL: '',
				KUCEDR_E2E_DATA_ROOT: userDataDir,
			},
		});
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		return { app, page, userDataDir };
	} catch (error) {
		await app?.close().catch(() => undefined);
		await rm(userDataDir, { recursive: true, force: true });
		throw error;
	}
}
