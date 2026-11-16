import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PluginTheme, PluginSource } from '../../shared/plugin_types';
import { scanPlugins } from './plugins_scan';
import { disabledPlugins } from './plugins_disabled';

export function readTheme(directory: string, plugin: PluginSource, enabled: boolean): PluginTheme {
 const id = path.basename(directory);
 const value: unknown = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
 if (!value || typeof value !== 'object') throw new Error(`themes/${id}: invalid manifest`);
 const theme = value as Record<string, unknown>;
 const validTokens = (tokens: unknown): tokens is Record<string, string> =>
  !!tokens && typeof tokens === 'object' && !Array.isArray(tokens) && Object.entries(tokens).every(([key, val]) => /^[a-z][a-z0-9-]*$/.test(key) && typeof val === 'string' && val.length > 0 && !/[;{}]/.test(val));
 if (theme.id !== id || typeof theme.title !== 'string' || !theme.title.trim() || !validTokens(theme.light) || !validTokens(theme.dark)) throw new Error(`themes/${id}: invalid manifest`);
 return { id, title: theme.title, plugin, enabled, light: theme.light, dark: theme.dark };
}

export function listThemes(): PluginTheme[] {
 const disabled = disabledPlugins();
 return scanPlugins().flatMap(({ id, directory, manifest }) => {
  if (!manifest) return [];
  return manifest.contributes.themes.flatMap((themeId) => {
   try { return [readTheme(path.join(directory, 'themes', themeId), { id, name: manifest.title, version: manifest.version }, !disabled.has(id))]; }
   catch (error) { console.warn(`[plugins] Invalid theme ${id}/${themeId}`, error); return []; }
  });
 });
}
