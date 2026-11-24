import { getMcpServersState } from '../mcp/mcp_store_state';
import {
	getDatabaseProvidersState,
	getModelProvidersState,
	getSearchEngines,
} from '../providers/providers_store';

const TTL_MS = 60_000;
// Shorter values match ordinary text too often to be told apart from a key.
const MIN_LENGTH = 16;
const MCP_TOKENS = ['token', 'client_secret', 'refresh_token', 'tokens'] as const;

let cache: { at: number; values: string[] } | undefined;

// The keys and tokens the app stores for providers and connectors. Connector environment values
// are left out: they hold paths and settings as often as secrets.
export function storedSecrets(): string[] {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
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
	cache = { at: Date.now(), values: [...values] };
	return cache.values;
}
