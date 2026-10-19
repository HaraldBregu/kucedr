import path from 'node:path';
import type { McpServerInfo } from '../../shared/mcp_types';
import { getLocalMcpEnvironment } from './mcp_store_state';
import { localMcpIdentity } from './mcp_local_identity';
import { parseMcpUrl } from './url';

/** Validates one local server entry; only `servers.json` entries may use the http transport. */
export function parseLocalMcpServer(
	value: unknown,
	directory: string,
	fallbackId: string,
	file: string,
	allowHttp = false
): McpServerInfo {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${file} must contain an object.`);
	}

	const manifest = value as Record<string, unknown>;
	const id =
		typeof manifest.id === 'string' && manifest.id.trim()
			? manifest.id.trim().toLowerCase()
			: fallbackId.toLowerCase();
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
		throw new Error('Server ID must use lowercase letters, numbers, and single hyphens.');
	}
	if (allowHttp && manifest.type === 'http') {
		if (typeof manifest.url !== 'string' || !manifest.url.trim()) {
			throw new Error('A non-empty url is required.');
		}
		parseMcpUrl(manifest.url.trim());
	} else if (manifest.type !== undefined && manifest.type !== 'stdio') {
		throw new Error(
			allowHttp
				? 'type must be "stdio" or "http".'
				: 'Local MCP manifests only support the stdio transport.'
		);
	} else if (typeof manifest.command !== 'string' || !manifest.command.trim()) {
		throw new Error('A non-empty command is required.');
	}
	if (
		manifest.args !== undefined &&
		(!Array.isArray(manifest.args) || manifest.args.some((item) => typeof item !== 'string'))
	) {
		throw new Error('Arguments must be an array of strings.');
	}
	if (
		manifest.env !== undefined &&
		(!manifest.env ||
			typeof manifest.env !== 'object' ||
			Array.isArray(manifest.env) ||
			Object.values(manifest.env).some((item) => typeof item !== 'string'))
	) {
		throw new Error('Environment variables must be a string-to-string object.');
	}
	if (
		manifest.require_approval !== undefined &&
		manifest.require_approval !== 'always' &&
		manifest.require_approval !== 'never'
	) {
		throw new Error('require_approval must be "always" or "never".');
	}
	if (manifest.enabled !== undefined && typeof manifest.enabled !== 'boolean') {
		throw new Error('enabled must be a boolean.');
	}
	if (manifest.defer_loading !== undefined && typeof manifest.defer_loading !== 'boolean') {
		throw new Error('defer_loading must be a boolean.');
	}
	if (manifest.cwd !== undefined && typeof manifest.cwd !== 'string') {
		throw new Error('cwd must be a string.');
	}
	if (manifest.name !== undefined && typeof manifest.name !== 'string') {
		throw new Error('name must be a string.');
	}

	const shared = {
		name: typeof manifest.name === 'string' ? manifest.name.trim() || undefined : undefined,
		require_approval: manifest.require_approval as 'always' | 'never' | undefined,
		defer_loading: manifest.defer_loading as boolean | undefined,
		enabled: manifest.enabled as boolean | undefined,
	};
	if (manifest.type === 'http') {
		return {
			id,
			source: 'local',
			path: directory,
			data: { type: 'http', url: (manifest.url as string).trim(), ...shared },
		};
	}
	const cwd =
		typeof manifest.cwd === 'string' && manifest.cwd.trim()
			? path.resolve(directory, manifest.cwd.trim())
			: directory;
	const command = (manifest.command as string).trim();
	const args = manifest.args as string[] | undefined;
	const environment = getLocalMcpEnvironment(id, localMcpIdentity({ command, args, cwd }));
	return {
		id,
		source: 'local',
		path: directory,
		data: {
			type: 'stdio',
			command,
			args,
			env: environment ?? (manifest.env as Record<string, string> | undefined),
			cwd,
			...shared,
		},
	};
}
