import { z } from 'zod';
import { pluginTools, renderPluginTool } from '../../../plugins';
import { tool } from '../tool';

export const runPluginTool = tool({
	id: 'run_plugin_tool',
	category: 'integration',
	name: 'Run plugin tool',
	description:
		'Run an external plugin tool by name. Its visual result is shown to the user automatically. Only use names listed under External tools.',
	planSafe: true,
	inputSchema: z.object({
		name: z.string().describe('One of the tools listed under External tools.'),
		input: z
			.record(z.string(), z.unknown())
			.describe("Input object matching that tool's input schema."),
	}),
	execute: async ({ name, input }) => {
		const tools = pluginTools();
		const found = tools.find((candidate) => candidate.name === name);
		if (!found) {
			throw new Error(
				`Unknown plugin tool "${name}". Available: ${tools.map((candidate) => candidate.name).join(', ') || 'none'}.`
			);
		}
		await renderPluginTool(name, input, 'light');
		return { ok: true, shown: `${found.title} displayed to the user.` };
	},
});
