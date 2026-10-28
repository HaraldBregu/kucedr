import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { pluginScripts } from '../../../plugins';
import { tool } from '../tool';

export const readPluginScript = tool({
	id: 'read_plugin_script',
	category: 'integration',
	name: 'Read plugin script instructions',
	description:
		'Read the instructions of a plugin script: every input field, allowed values and examples. Call this before run_plugin_script.',
	planSafe: true,
	inputSchema: z.object({
		name: z.string().describe('The script name documented by the loaded skill.'),
	}),
	execute: async ({ name }) => {
		const scripts = pluginScripts();
		const found = scripts.find((candidate) => candidate.name === name);
		if (!found) {
			throw new Error(
				`Unknown plugin script "${name}". Available: ${scripts.map((candidate) => candidate.name).join(', ') || 'none'}.`
			);
		}
		return readFileSync(
			path.join(found.directory, ...found.metadata.instructions.split('/')),
			'utf8'
		);
	},
});
