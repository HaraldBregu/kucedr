import { z } from 'zod';
import { pluginScripts, renderPluginScript } from '../../../plugins';
import { tool } from '../tool';

export const runScript = tool({
	id: 'run_script',
	category: 'integration',
	name: 'Run script',
	description:
		'Run a script from the Scripts section by name, with the input documented in its instructions. Its visual result is shown to the user automatically.',
	planSafe: true,
	inputSchema: z.object({
		name: z.string().describe('The script name from the Scripts section.'),
		input: z
			.record(z.string(), z.unknown())
			.describe('Input object documented in the instructions returned by load_script.'),
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
