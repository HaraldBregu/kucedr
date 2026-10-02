import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { atomicWrite } from '../shared/atomic_write';
import { userDataLocation } from '../shared/user_data_location';
import { userSchema, type UserSettings } from './schema';

export async function updateUser(settings: UserSettings): Promise<UserSettings> {
	const user = userSchema.parse(settings);
	await mkdir(path.join(userDataLocation(), 'user'), { recursive: true });
	await atomicWrite(path.join(userDataLocation(), 'user', 'settings.json'), JSON.stringify(user, null, 2) + '\n');
	return user;
}
