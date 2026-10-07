const launchPersistentContext = jest.fn();

jest.mock('playwright-core', () => ({
	chromium: { launchPersistentContext },
}));

import { useWebBrowserTool } from '../../../../../src/main/agent/tools/web/use_web_browser';

it('explains how to resolve a blocked or missing Chrome installation', async () => {
	launchPersistentContext.mockRejectedValue(new Error('Executable does not exist'));

	await expect(useWebBrowserTool.run({ action: 'start' })).rejects.toThrow(
		'Browser automation could not start Google Chrome. Make sure Chrome is installed, permitted by system policy, and able to write to the Kucedr profile.\nExecutable does not exist'
	);
});
