import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
	SkillDiagnostic,
	SkillLoadResult,
	SkillRegistrySnapshot,
} from '../../../shared/skills_types';
import {
	SKILL_FILE,
	SKILL_MAX_BYTES,
	SKILL_RECOMMENDED_LINES,
	SKILL_RECOMMENDED_TOKENS,
} from './skills_limits';
import { listSkillResources } from './skills_resources';
import { stripFrontmatter } from './skills_strip_frontmatter';
import { validateSkill } from './skills_validate';

export async function inspectSkill(
	snapshot: SkillRegistrySnapshot,
	name: string
): Promise<SkillLoadResult> {
	const wanted = name.trim().toLowerCase();
	const skill = snapshot.skills.find(
		(entry) => entry.name.toLowerCase() === wanted || entry.id.toLowerCase() === wanted
	);
	if (!skill) throw new Error(`Skill "${name}" was not found in this run's registry.`);
	const validation = validateSkill(skill.folderPath);
	if (!validation.valid)
		throw new Error(
			`Skill "${skill.name}" is malformed: ${validation.issues.map((issue) => issue.message).join('; ')}`
		);
	const canonicalRoot = fs.realpathSync(skill.folderPath);
	const skillPath = fs.realpathSync(path.join(canonicalRoot, SKILL_FILE));
	const source = fs.readFileSync(skillPath, 'utf8');
	if (Buffer.byteLength(source, 'utf8') > SKILL_MAX_BYTES)
		throw new Error(`Skill "${skill.name}" exceeds the ${SKILL_MAX_BYTES}-byte limit.`);
	const hash = createHash('sha256').update(source).digest('hex');
	const instructions = stripFrontmatter(source);
	const lineCount = instructions.split(/\r?\n/).length;
	const estimatedTokens = Math.ceil(Buffer.byteLength(instructions, 'utf8') / 3);
	const warnings: SkillDiagnostic[] = [];
	if (lineCount > SKILL_RECOMMENDED_LINES || estimatedTokens > SKILL_RECOMMENDED_TOKENS) {
		warnings.push({
			level: 'warning',
			code: 'large-instructions',
			message: `Skill instructions are about ${estimatedTokens} tokens across ${lineCount} lines; under 5,000 tokens and 500 lines is recommended.`,
		});
	}
	return {
		id: skill.id,
		name: skill.name,
		canonicalRoot,
		instructions,
		source: skill.source,
		trust: skill.trust,
		hash,
		resources: listSkillResources(canonicalRoot),
		warnings,
	};
}
