import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deleteApp } from '../../../../src/main/apps/app_delete';

it('deletes only a validated app directory', () => {
	const appLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-delete-'));
	const app = path.join(appLocation, 'apps', 'demo-app');
	const appData = path.join(app, 'data');
	const outside = path.join(appLocation, 'outside');
	fs.mkdirSync(app, { recursive: true });
	fs.mkdirSync(appData, { recursive: true });
	fs.writeFileSync(path.join(appData, 'store.json'), '{}');
	fs.mkdirSync(outside);

	try {
		deleteApp('demo-app', appLocation);
		expect(fs.existsSync(app)).toBe(false);
		expect(fs.existsSync(appData)).toBe(false);
		expect(() => deleteApp('../outside', appLocation)).toThrow('Invalid app ID.');
		expect(fs.existsSync(outside)).toBe(true);
	} finally {
		fs.rmSync(appLocation, { recursive: true, force: true });
	}
});
