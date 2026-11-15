import { pluginDirs } from '../../plugins/plugins_dirs';
import { skillsRoot } from '../skills/skills_root';
import { samePathOrWithin } from './same_path_or_within';

export function isSkillTarget(target: string): boolean {
	return [skillsRoot, ...pluginDirs('skills').map((entry) => entry.directory)].some((root) =>
		samePathOrWithin(target, root)
	);
}
