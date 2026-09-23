import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export function getOrCreateDeviceId(database: DatabaseSync): string {
	const existing = database.prepare('SELECT device_id FROM device_identity WHERE id = 1')
		.get() as { device_id: string } | undefined;
	if (existing) return existing.device_id;
	database.prepare('INSERT OR IGNORE INTO device_identity (id, device_id) VALUES (1, ?)')
		.run(randomUUID());
	return (database.prepare('SELECT device_id FROM device_identity WHERE id = 1')
		.get() as { device_id: string }).device_id;
}
