import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

export class RpcError extends Error {
	constructor(readonly code: string) {
		super('Database request failed');
	}
}

export async function rpc<T>(database: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
	const { data, error } = await database.rpc(name, args);
	if (error) throw new RpcError(error.code ?? '');
	return data as T;
}
