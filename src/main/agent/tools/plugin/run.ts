import { z } from 'zod';
import { pluginScripts, renderPluginScript } from '../../../plugins';
import { tool } from '../tool';

export const runPluginScript = tool({
	id: 'run_plugin_script',
	category: 'integration',
	name: 'Run plugin script',
	description:
		'Run a plugin script by name using the input documented by a loaded skill. Its visual result is shown to the user automatically.',
	planSafe: true,
	inputSchema: z.object({
		name: z.string().describe('The script name documented by the loaded skill.'),
		input: z
			.record(z.string(), z.unknown())
			.describe('Input object documented in the instructions returned by read_plugin_script.'),
	}),
	execute: async ({ name, input }) => {
		const scripts = pluginScripts();
		const found = scripts.find((candidate) => candidate.name === name);
		if (!found) {
			throw new Error(
				`Unknown plugin script "${name}". Available: ${scripts.map((candidate) => candidate.name).join(', ') || 'none'}.`
			);
		}
		await renderPluginScript(name, input, 'light');
		return { ok: true, shown: `${found.title} displayed to the user.` };
	},
});
