import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pluginDirs } from '../../plugins';
import { readMode } from './read';
import type { ModeDefinition } from './types';

/** Every enabled plugin's modes; the first plugin to claim an id or command wins. */
export function listModes(): ModeDefinition[] {
	const modes: ModeDefinition[] = [];
	for (const { directory, plugin, builtIn } of pluginDirs('modes')) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
			try {
				const mode = readMode(path.join(directory, entry.name), plugin, builtIn);
				if (modes.some(({ id, command }) => id === mode.id || command === mode.command)) {
					console.warn(`[plugins] Mode "${mode.id}" from ${plugin.id} is already provided.`);
					continue;
				}
				modes.push(mode);
			} catch (error) {
				console.warn(`[plugins] ${plugin.id}: ${error instanceof Error ? error.message : error}`);
			}
		}
	}
	return modes;
}
