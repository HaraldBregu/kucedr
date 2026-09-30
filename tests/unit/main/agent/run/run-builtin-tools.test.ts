import { builtinTools } from '../../../../../src/main/agent/runner/run_builtin_tools';
import type { ExecSandbox } from '../../../../../src/main/agent/sandbox';

it('registers health tools without app-management tools', () => {
	const ids = builtinTools({ location: '/workspace' }, {} as ExecSandbox).map((tool) => tool.id);
	expect(ids).toEqual(expect.arrayContaining(['get_health', 'update_health']));

	expect(ids).not.toEqual(
		expect.arrayContaining([
			'list_apps',
			'open_apps',
			'close_apps',
			'update_health_settings',
		])
	);
});
