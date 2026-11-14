import { pluginDirs } from '../../plugins/plugins_dirs';
import { realPath } from '../../shared/real_path';
import { skillsRoot } from '../skills/skills_root';
import { isPathWithin } from './permissions_path';

export function isSkillTarget(target: string): boolean {
	const resolved = realPath(target);
	return [skillsRoot, ...pluginDirs('skills').map((entry) => entry.directory)].some((root) =>
		isPathWithin(realPath(root), resolved)
	);
}
