import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

export async function authenticate(request: Request) {
	const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
	if (!token) throw new Error('Missing account token');
	const url = Deno.env.get('SUPABASE_URL');
	const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	if (!url || !publicKey || !serviceKey) throw new Error('Storage backend is not configured');
	const verifier = createClient(url, publicKey, { auth: { persistSession: false } });
	const { data, error } = await verifier.auth.getUser(token);
	if (error || !data.user) throw new Error('Invalid account token');
	return {
		ownerId: data.user.id,
		database: createClient(url, serviceKey, { auth: { persistSession: false } }),
	};
}
