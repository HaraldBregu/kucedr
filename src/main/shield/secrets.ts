import { statSync } from 'node:fs';
import { getMcpServersState, mcpStorePath } from '../mcp/mcp_store_state';
import {
	getDatabaseProvidersState,
	getModelProvidersState,
	getSearchEngines,
	providersStorePath,
} from '../providers/providers_store';

// Shorter values match ordinary text too often to be told apart from a key.
const MIN_LENGTH = 16;
const MCP_TOKENS = ['token', 'client_secret', 'refresh_token', 'tokens'] as const;

let cache: { stamp: string; values: string[] } | undefined;

// The keys and tokens the app stores for providers and connectors, read again whenever either
// store file changes. Connector environment values are left out: they hold paths and settings
// as often as secrets.
export function storedSecrets(): string[] {
	const stamp = [providersStorePath, mcpStorePath]
		.map((file) => statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? 0)
		.join(':');
	if (cache?.stamp === stamp) return cache.values;
	const values = new Set<string>();
	const add = (value: unknown): void => {
		if (typeof value === 'string') {
			if (value.length >= MIN_LENGTH && !/\s/.test(value)) values.add(value);
		} else if (value && typeof value === 'object') for (const item of Object.values(value)) add(item);
	};
	for (const provider of [...getModelProvidersState(), ...getDatabaseProvidersState(), ...getSearchEngines()])
		add(provider.apiKey);
	for (const server of getMcpServersState())
		for (const key of MCP_TOKENS) add((server as unknown as Record<string, unknown>)[key]);
	cache = { stamp, values: [...values] };
	return cache.values;
}
