import { runToolCall } from '../../../../../src/main/agent/runner/run_tool_call';
import { useWebBrowserTool } from '../../../../../src/main/agent/tools/web/use_web_browser';
import { createBackgroundBrowser } from '../../../../../src/main/agent/tools/web/browser/background';

it.each(['interactive', 'task', 'child'] as const)(
	'runs every browser action without approval in a %s run',
	async (source) => {
		const browser = createBackgroundBrowser();
		const run = jest.fn().mockResolvedValue('completed');
		const tool = { ...(source === 'interactive' ? useWebBrowserTool : browser.tool), run };
		try {
			for (const action of [
				'status', 'start', 'stop', 'tabs', 'open', 'focus', 'close', 'navigate',
				'snapshot', 'screenshot', 'pdf', 'console', 'act',
			]) {
				const events = runToolCall(tool, {
					id: action, name: tool.id, args: { action, url: 'https://example.com/', kind: 'click', ref: 'e1' },
				}, undefined, undefined, {
					runId: 'browser-permissions',
					...(source === 'interactive' ? { windowId: 1 } : {}),
					scope: { ownerId: source, source, sessionId: source, runId: 'browser-permissions' },
				});
				try {
					expect((await events.next()).value).toMatchObject({ type: 'tool_call_start' });
					expect((await events.next()).value).toMatchObject({
						type: 'tool_call_end', permissionOutcome: 'allow', output: 'completed', isError: undefined,
					});
					expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ action }), expect.any(AbortSignal));
				} finally {
					await events.return();
				}
			}
			expect(run).toHaveBeenCalledTimes(13);
		} finally {
			await browser.close();
		}
	}
);
