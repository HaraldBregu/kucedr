import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { atomicWrite } from '../shared/atomic_write';
import { userDataLocation } from '../shared/user_data_location';
import { soulSchema, type SoulSettings } from './schema';

export async function updateSoul(settings: SoulSettings): Promise<SoulSettings> {
	const soul = soulSchema.parse(settings);
	await mkdir(path.join(userDataLocation(), 'soul'), { recursive: true });
	await atomicWrite(path.join(userDataLocation(), 'soul', 'settings.json'), JSON.stringify(soul, null, 2) + '\n');
	return soul;
}
