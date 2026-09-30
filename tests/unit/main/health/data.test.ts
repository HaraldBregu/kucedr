import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/tmp/kucedr-health-data-test',
}));

import { getHealth, updateHealth } from '../../../../src/main/health';

const root = '/tmp/kucedr-health-data-test';
const workspace = path.join(root, 'workspace');
const healthFile = path.join(root, 'health', 'HEALTH.md');

beforeEach(async () => {
	await rm(root, { recursive: true, force: true });
	await mkdir(workspace, { recursive: true });
});

it('migrates HEALTH.md from the workspace and updates it in the health folder', async () => {
	await writeFile(path.join(workspace, 'HEALTH.md'), '# Legacy health');
	expect(await getHealth({ location: workspace })).toBe('# Legacy health');
	expect(await readFile(healthFile, 'utf8')).toBe('# Legacy health');

	await updateHealth({ location: workspace }, '# Current health');
	expect(await readFile(healthFile, 'utf8')).toBe('# Current health');
});
