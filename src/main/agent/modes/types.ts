import type { ModelReasoningEffort } from '../../../shared/agent_types';
import type { PluginSource } from '../../../shared/plugin_types';
import type { SessionUsage } from '../session';
import type { Tool } from '../types';

export type ModePermissions = 'default' | 'deny-asks';
export type ModeShell = 'default' | 'read-only' | 'none';

export interface ModeDefinition {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly command: string;
	readonly prompt?: string;
	readonly protectedPrompt?: boolean;
	readonly tools?: 'read-only' | readonly string[];
	readonly permissions?: ModePermissions;
	readonly shell?: ModeShell;
	readonly effort?: ModelReasoningEffort;
	readonly model?: string;
	readonly output?: { readonly envelope: string };
	readonly action?: { readonly label: string; readonly prompt: string };
	readonly behavior?: 'goal';
	readonly plugin: PluginSource;
}

/** What a run's active modes add up to, pinned at run start. */
export interface ModePolicy {
	readonly ids: readonly string[];
	readonly restricted: boolean;
	readonly readOnly: boolean;
	readonly toolIds?: readonly string[];
	readonly permissions: ModePermissions;
	readonly shell: ModeShell;
	readonly prompt: string;
	readonly protectedPrompt: string;
	readonly effort?: ModelReasoningEffort;
	readonly model?: string;
	readonly output?: { readonly envelope: string };
	readonly behavior?: string;
}

export const NO_MODE: ModePolicy = {
	ids: [],
	restricted: false,
	readOnly: false,
	permissions: 'default',
	shell: 'default',
	prompt: '',
	protectedPrompt: '',
};

export interface ModeCommand {
	readonly message: string;
	readonly continues: boolean;
	apply(sessionDirectory: string): string;
}

/** Host code that a bundled mode can switch on, for what data can't express. */
export interface ModeBehavior {
	readonly id: string;
	parse(message: string): ModeCommand | undefined;
	tools(sessionDirectory: string): Tool[];
	context(sessionDirectory: string): string;
	account(sessionDirectory: string, usage: SessionUsage, toolCalls: number): void;
}
