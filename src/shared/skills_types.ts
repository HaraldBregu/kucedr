import type { PluginSource } from './plugin_types';

export type SkillSource = 'user' | 'plugin';

export type SkillTrust = 'user-controlled';

export interface SkillManifest {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	allowedTools?: string[];
	metadata?: Record<string, string>;
}

export interface SkillInfo {
	id: string;
	name: string;
	description: string;
	folderPath: string;
	skillPath?: string;
	manifest: SkillManifest;
	source: SkillSource;
	trust: SkillTrust;
	/** Set when an installed plugin contributes this skill. */
	plugin?: PluginSource;
	hash: string;
	diagnostics?: SkillDiagnostic[];
	structure?: SkillStructureInfo;
}

export interface SkillDownloadResult {
	id: string;
	destinationPath: string;
	name?: string;
}

export interface SkillLoadResult {
	id: string;
	name: string;
	canonicalRoot: string;
	instructions: string;
	source: SkillSource;
	trust: SkillTrust;
	hash: string;
	resources: string[];
	warnings: SkillDiagnostic[];
}

export interface SkillRegistrySnapshot {
	skills: readonly SkillInfo[];
	/** Folders under a skill root that failed validation, with their diagnostics. */
	invalid: readonly SkillInfo[];
	diagnostics: readonly SkillDiagnostic[];
}

export interface SkillValidationIssue {
	code: string;
	message: string;
}

export interface SkillValidationResult {
	valid: boolean;
	issues: SkillValidationIssue[];
}

export interface SkillDeleteResult {
	id: string;
	name: string;
	deleted: boolean;
}

export interface SkillDiagnostic {
	level: 'warning' | 'error';
	code: string;
	message: string;
}

export interface SkillStructureInfo {
	format: 'agent-skill';
	standard: 'agentskills.io';
	resourceDirectories: string[];
}

export interface SkillImportSkipped {
	name: string;
	sourcePath: string;
	reason: string;
}

export interface SkillImportResult {
	imported: SkillInfo[];
	skipped: SkillImportSkipped[];
}
