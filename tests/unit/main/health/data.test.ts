import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/tmp/kucedr-health-data-test',
}));

import { getHealth, updateHealth } from '../../../../src/main/health';
import { buildWorkspace } from '../../../../src/main/workspaces/build';

const root = '/tmp/kucedr-health-data-test';
const workspace = path.join(root, 'workspace');
const healthFile = path.join(root, 'health', 'HEALTH.md');
const config = { location: workspace, workspace: buildWorkspace('default', root, workspace) };

beforeEach(async () => {
	await rm(root, { recursive: true, force: true });
	await mkdir(workspace, { recursive: true });
});

it('migrates HEALTH.md from the workspace and updates it in the health folder', async () => {
	await writeFile(path.join(workspace, 'HEALTH.md'), '# Legacy health');
	expect(await getHealth(config)).toBe('# Legacy health');
	expect(await readFile(healthFile, 'utf8')).toBe('# Legacy health');

	await updateHealth(config, '# Current health');
	expect(await readFile(healthFile, 'utf8')).toBe('# Current health');
});

it('recreates a missing HEALTH.md from its template', async () => {
	await getHealth(config);
	await rm(healthFile);
	const template = await readFile(path.resolve('resources/templates/HEALTH.md'), 'utf8');
	expect(await getHealth(config)).toBe(template);
	expect(await readFile(healthFile, 'utf8')).toBe(template);
});
