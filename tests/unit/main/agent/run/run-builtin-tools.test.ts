import { builtinTools } from '../../../../../src/main/agent/runner/run_builtin_tools';
import type { ExecSandbox } from '../../../../../src/main/agent/sandbox';
import { toolCategoryRegistry } from '../../../../../src/main/agent/tools/category';

it('registers health tools without app-management tools', () => {
	const ids = builtinTools({ location: '/workspace' }, {} as ExecSandbox).map((tool) => tool.id);
	expect(ids).toEqual(expect.arrayContaining(['get_health', 'update_health']));

	expect(ids).not.toEqual(
		expect.arrayContaining(['list_apps', 'open_apps', 'close_apps', 'update_health_settings'])
	);
});

it('assigns every built-in tool a registered category', () => {
	const categories = new Set(Object.keys(toolCategoryRegistry));
	const tools = builtinTools({ location: '/workspace' }, {} as ExecSandbox);

	expect(tools).not.toHaveLength(0);
	for (const tool of tools) expect(categories).toContain(tool.category);
});
