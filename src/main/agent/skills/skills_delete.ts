import fs from 'node:fs';
import { readSkill } from './skills_read';
import { resolveSkillFolder } from './skills_resolve_folder';
import type { SkillDeleteResult } from '../../../shared/skills_types';
import { pluginOwner } from '../../plugins/plugins_owner';

export function deleteSkill(id: string): SkillDeleteResult {
	const folder = resolveSkillFolder(id);
	const plugin = pluginOwner(folder);
	if (plugin)
		throw new Error(
			`This skill comes from the ${plugin.name} plugin. Disable or remove the plugin instead.`
		);
	const name = readSkill(folder, id)?.name ?? id;
	fs.rmSync(folder, { recursive: true, force: true });
	return { id, name, deleted: true };
}
