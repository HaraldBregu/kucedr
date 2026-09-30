import path from 'node:path';
import { atomicWrite } from '../shared/atomic_write';
import { userDataLocation } from '../shared/user_data_location';

export async function updateIdentity(content: string): Promise<string> {
	await atomicWrite(path.join(userDataLocation(), 'identity', 'IDENTITY.md'), content);
	return content;
}
