import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ReadPlugin } from './plugins_read';
import { readAppManifestFromDirectory } from '../apps/app_read';
import { listLocalMcpServers } from '../mcp/mcp_local_list';
import { validateSkill } from '../agent/skills/skills_validate';
import { CORE_PLUGIN_ID } from '../../shared/plugin_types';

/** Install-time checks that each contribution is readable by the loader that will serve it. */
export function validatePluginContents(directory: string, manifest: ReadPlugin): void {
	if (manifest.id === CORE_PLUGIN_ID)
		throw new Error(`"${CORE_PLUGIN_ID}" is reserved for Kucedr.`);
	for (const id of manifest.contributes.apps) {
		const folder = path.join(directory, 'apps', id);
		const app = readAppManifestFromDirectory(folder);
		if (!app) throw new Error(`apps/${id} needs a valid app manifest.json.`);
		const entry = path.join(folder, ...app.metadata.entry.split('/'));
		if (!existsSync(entry) || !statSync(entry).isFile()) {
			throw new Error(`apps/${id}: entry ${app.metadata.entry} does not exist.`);
		}
	}
	if (manifest.contributes.mcp.length > 0) {
		const [problem] = listLocalMcpServers(path.join(directory, 'mcp')).diagnostics;
		if (problem) throw new Error(`mcp/${problem.name}: ${problem.error}`);
	}
	for (const id of manifest.contributes.tools) readPluginTool(path.join(directory, 'tools', id));
	for (const id of manifest.contributes.skills) {
		const validation = validateSkill(path.join(directory, 'skills', id));
		if (!validation.valid) {
			throw new Error(
				`skills/${id}: ${validation.issues.map((issue) => issue.message).join('; ')}`
			);
		}
	}
}
