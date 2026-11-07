import type { ModelReasoningEffort } from '../../../shared/agent_types';
import type { PluginSource } from '../../../shared/plugin_types';

export type ModePermissions = 'default' | 'deny-asks';
export type ModeShell = 'default' | 'read-only' | 'none';

export interface ModeDefinition {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly command: string;
	readonly persistent?: boolean;
	readonly ask?: boolean;
	readonly prompt: string;
	readonly protectedPrompt?: boolean;
	readonly tools?: 'read-only' | readonly string[];
	readonly permissions?: ModePermissions;
	readonly shell?: ModeShell;
	readonly effort?: ModelReasoningEffort;
	readonly model?: string;
	readonly output?: { readonly envelope: string };
	readonly action?: { readonly label: string; readonly prompt: string };
	readonly state?: { readonly evidence?: boolean; readonly continue?: boolean };
	readonly plugin: PluginSource;
}

/** What a run's active modes add up to, pinned at run start. */
export interface ModePolicy {
	readonly ids: readonly string[];
	readonly restricted: boolean;
	readonly readOnly: boolean;
	readonly ask: boolean;
	readonly toolIds?: readonly string[];
	readonly permissions: ModePermissions;
	readonly shell: ModeShell;
	readonly prompt: string;
	readonly protectedPrompt: string;
	readonly effort?: ModelReasoningEffort;
	readonly model?: string;
	readonly output?: { readonly envelope: string };
}

export const NO_MODE: ModePolicy = {
	ids: [],
	restricted: false,
	readOnly: false,
	ask: false,
	permissions: 'default',
	shell: 'default',
	prompt: '',
	protectedPrompt: '',
};
