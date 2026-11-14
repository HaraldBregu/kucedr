import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import type { SkillInfo, SkillManifest, SkillSource } from '../../../shared/skills_types';
import { SKILL_FILE, SKILL_MAX_BYTES } from './skills_limits';
import { validateSkill } from './skills_validate';

export { SKILL_FILE } from './skills_limits';
const RESOURCE_DIRECTORIES = ['scripts', 'references', 'assets'] as const;

export function readSkill(
	folder: string,
	id: string,
	origin: SkillSource = 'user'
): SkillInfo | undefined {
	const validation = validateSkill(folder);
	if (!validation.valid) return undefined;
	let canonicalSkillPath: string;
	let source: string;
	let fm: Record<string, unknown>;
	try {
		canonicalSkillPath = fs.realpathSync(path.join(folder, SKILL_FILE));
		source = fs.readFileSync(canonicalSkillPath, 'utf8');
		if (Buffer.byteLength(source, 'utf8') > SKILL_MAX_BYTES) return undefined;
		fm = matter(source).data as Record<string, unknown>;
	} catch {
		return undefined;
	}
	const name = fm.name as string;
	const description = fm.description as string;
	const allowedTools =
		typeof fm['allowed-tools'] === 'string'
			? fm['allowed-tools'].trim().split(/\s+/).filter(Boolean)
			: undefined;
	const manifest: SkillManifest = {
		name,
		description,
		...(typeof fm.license === 'string' ? { license: fm.license } : {}),
		...(typeof fm.compatibility === 'string' ? { compatibility: fm.compatibility } : {}),
		...(fm.metadata && typeof fm.metadata === 'object'
			? {
					metadata: Object.fromEntries(
						Object.entries(fm.metadata).map(([key, value]) => [key, String(value)])
					),
				}
			: {}),
		...(allowedTools ? { allowedTools } : {}),
	};
	const hash = createHash('sha256').update(source).digest('hex');
	return {
		id,
		name,
		description,
		folderPath: folder,
		skillPath: canonicalSkillPath,
		manifest,
		source: origin,
		trust: 'user-controlled',
		hash,
		structure: {
			format: 'agent-skill',
			standard: 'agentskills.io',
			resourceDirectories: RESOURCE_DIRECTORIES.filter((dir) =>
				fs.existsSync(path.join(folder, dir))
			),
		},
	};
}
