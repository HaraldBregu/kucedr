import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-bundled-workspace-'));

jest.mock('../../../../src/main/shared/resource_root', () => ({ resourceRoot: () => root }));
jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => path.join(root, 'user-data'),
}));

import { ensureApps } from '../../../../src/main/apps/app_ensure';

it('installs and refreshes the bundled Workspace UI while retaining window settings', () => {
	const bundled = path.join(root, 'resources/apps/workspace');
	fs.mkdirSync(path.join(bundled, 'dist'), { recursive: true });
	fs.mkdirSync(path.join(bundled, 'assets/images'), { recursive: true });
	const manifest = {
		title: 'Workspace',
		description: 'Workspace app.',
		metadata: { version: '1.0.0', category: 'utility', entry: 'dist/index.html' },
	};
	fs.writeFileSync(path.join(bundled, 'manifest.json'), JSON.stringify(manifest));
	fs.writeFileSync(path.join(bundled, 'assets/images/logo.png'), 'logo');
	fs.writeFileSync(path.join(bundled, 'dist/index.html'), 'first build');

	expect(ensureApps()).toEqual([{ id: 'workspace', ...manifest }]);
	const installed = path.join(root, 'user-data/apps/workspace');
	expect(fs.readFileSync(path.join(installed, 'dist/index.html'), 'utf8')).toBe('first build');

	fs.writeFileSync(
		path.join(installed, 'manifest.json'),
		JSON.stringify({ ...manifest, window: { width: 1200 } })
	);
	fs.writeFileSync(path.join(bundled, 'dist/index.html'), 'second build');
	ensureApps();
	expect(fs.readFileSync(path.join(installed, 'dist/index.html'), 'utf8')).toBe('second build');
	expect(JSON.parse(fs.readFileSync(path.join(installed, 'manifest.json'), 'utf8')).window).toEqual({
		width: 1200,
	});
	fs.rmSync(root, { recursive: true, force: true });
});
