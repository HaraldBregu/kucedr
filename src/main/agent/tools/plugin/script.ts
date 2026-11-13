import { pluginScripts } from '../../../plugins';

export function findScript(name: string) {
	const scripts = pluginScripts();
	const found = scripts.find((candidate) => candidate.name === name);
	if (!found) {
		throw new Error(
			`Unknown plugin script "${name}". Available: ${scripts.map((candidate) => candidate.name).join(', ') || 'none'}.`
		);
	}
	return found;
}
