import path from 'node:path';

const root = '/tmp/kucedr-mcp-store-test';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => root,
}));
jest.mock('../../../../src/main/shared/restrict_settings_file', () => ({
	restrictSettingsFile: jest.fn(),
}));

import { mcpStorePath } from '../../../../src/main/mcp/mcp_store_state';

it('stores MCP settings under the MCP folder', () => {
	expect(mcpStorePath).toBe(path.join(root, 'mcp', 'settings.json'));
});
