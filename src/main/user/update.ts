import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { atomicWrite } from '../shared/atomic_write';
import { userDataLocation } from '../shared/user_data_location';

export async function updateUser(content: string): Promise<string> {
	await mkdir(path.join(userDataLocation(), 'user'), { recursive: true });
	await atomicWrite(path.join(userDataLocation(), 'user', 'USER.md'), content);
	return content;
}
