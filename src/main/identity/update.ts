import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { atomicWrite } from '../shared/atomic_write';
import { userDataLocation } from '../shared/user_data_location';
import { identitySchema, type IdentitySettings } from './schema';

export async function updateIdentity(settings: IdentitySettings): Promise<IdentitySettings> {
	const identity = identitySchema.parse(settings);
	await mkdir(path.join(userDataLocation(), 'identity'), { recursive: true });
	await atomicWrite(path.join(userDataLocation(), 'identity', 'settings.json'), JSON.stringify(identity, null, 2) + '\n');
	return identity;
}
