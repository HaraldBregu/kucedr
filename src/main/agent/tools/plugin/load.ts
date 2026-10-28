import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { pluginScripts } from '../../../plugins';
import { tool } from '../tool';

export const loadScript = tool({
	id: 'load_script',
	category: 'integration',
	name: 'Load script',
	description:
		'Load the instructions of a script from the Scripts section: every input field, allowed values and examples. Call this before run_script.',
	planSafe: true,
	inputSchema: z.object({
		name: z.string().describe('The script name from the Scripts section.'),
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
