import type { PluginSource } from './plugin_types';

export type SkillSource = 'local-filesystem';

export type SkillTrust = 'user-controlled';

export interface SkillManifest {
	id?: string;
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
	location: string;
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
	allowedTools?: string[];
	resources: string[];
	warnings: SkillDiagnostic[];
}

export interface SkillFrontmatter {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	metadata?: Record<string, string>;
	allowedTools?: string[];
}

export interface SkillRegistrySnapshot {
	skills: readonly SkillInfo[];
	diagnostics: readonly SkillDiagnostic[];
}

export interface SkillSearchOptions {
	names?: string[];
	limit?: number;
}

export interface SkillSearchResult {
	id: string;
	name: string;
	description: string;
	score: number;
	reason: string;
}

export interface SkillSupportFile {
	relativePath: string;
	kind: 'script' | 'reference' | 'asset' | 'file';
	size: number;
}

export interface SkillValidationIssue {
	code: string;
	message: string;
}

export interface SkillValidationResult {
	valid: boolean;
	issues: SkillValidationIssue[];
	skill?: {
		info: SkillInfo;
		frontmatter: SkillFrontmatter;
		instructions?: string;
	};
}

export interface SkillDetails extends SkillInfo {
	frontmatter: SkillFrontmatter;
	instructions: string;
	supportFiles: SkillSupportFile[];
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
	kind: 'direct' | 'container-child';
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

export interface AnthropicSkillEntry {
	type: 'anthropic' | 'custom';
	skill_id: string;
	version?: string;
}

export interface AnthropicSkillContainer {
	skills: AnthropicSkillEntry[];
}

export interface OpenAIHostedSkillEntry {
	type: 'skill_reference';
	skill_id: string;
	version?: number | 'latest';
}

export interface OpenAILocalSkillEntry {
	name: string;
	description: string;
	path: string;
}

export type SkillAdapterTarget =
	| { provider: 'anthropic'; remoteId: string; version?: string }
	| { provider: 'openai-hosted'; remoteId: string; version?: number | 'latest' }
	| { provider: 'openai-local' };

export interface ResolvedSkillAttachment {
	anthropic?: AnthropicSkillContainer;
	openaiHosted?: OpenAIHostedSkillEntry[];
	openaiLocal?: OpenAILocalSkillEntry[];
}
