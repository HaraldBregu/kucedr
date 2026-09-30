import { copyFile, mkdir, readFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Config } from '../agent/types';
import { workspacePath } from '../agent/system';
import { atomicWrite } from '../shared/atomic_write';
import { healthRoot } from './root';

const HEALTH_FILE = 'HEALTH.md';

function healthPath(): string {
	return path.join(healthRoot(), HEALTH_FILE);
}

function templatePath(): string {
	const relativePath = path.join('resources', 'templates', HEALTH_FILE);
	if (process.defaultApp || !process.resourcesPath) return path.resolve(process.cwd(), relativePath);
	return path.join(process.resourcesPath, relativePath);
}

async function ensureHealth(config: Config): Promise<string> {
	const filePath = healthPath();
	if (existsSync(filePath)) return filePath;
	await mkdir(healthRoot(), { recursive: true });
	const legacyPath = path.join(workspacePath(config), HEALTH_FILE);
	if (existsSync(legacyPath)) await rename(legacyPath, filePath);
	else await copyFile(templatePath(), filePath);
	return filePath;
}

export async function getHealth(config: Config): Promise<string> {
	return readFile(await ensureHealth(config), 'utf8');
}

export async function updateHealth(config: Config, content: string): Promise<string> {
	await atomicWrite(await ensureHealth(config), content);
	return content;
}
