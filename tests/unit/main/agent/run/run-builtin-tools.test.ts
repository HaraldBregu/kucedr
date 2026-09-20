import { builtinTools } from '../../../../../src/main/agent/runner/run_builtin_tools';
import type { ExecSandbox } from '../../../../../src/main/agent/sandbox';

it('does not register app-management tools', () => {
	const ids = builtinTools({ location: '/workspace' }, {} as ExecSandbox).map((tool) => tool.id);

	expect(ids).not.toEqual(expect.arrayContaining(['list_apps', 'open_apps', 'close_apps']));
});
