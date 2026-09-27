import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CloudConfig } from '../config';
import type { AuthStorage } from '../session';

export function createSupabaseClient(config: CloudConfig, storage: AuthStorage): SupabaseClient {
	return createClient(config.url, config.publishableKey, {
		auth: {
			autoRefreshToken: true,
			persistSession: true,
			storage,
			detectSessionInUrl: false,
			flowType: 'pkce',
		},
	});
}
