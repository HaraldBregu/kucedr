import type { PluginSource } from './plugin_types';

/** An enabled agent mode, as the composer and message cards see it. */
export interface ModeInfo {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly command: string;
	/** Whether the composer chip stays active after a message is sent. */
	readonly persistent: boolean;
	readonly envelope?: string;
	readonly action?: { readonly label: string; readonly prompt: string };
	readonly plugin: PluginSource;
}
