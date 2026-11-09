import type { StorageService } from '../../shared/storage_types';
import { loadStorageServices } from '../models';
import { resolveBackupService } from './resolve';

export function listBackupServices(): StorageService[] {
	return loadStorageServices().map((service) => {
		const id = `${service.provider.id}/${service.id}`;
		let configured = true;
		try {
			resolveBackupService(id);
		} catch {
			configured = false;
		}
		return {
			id,
			name: service.name,
			pluginId: service.provider.id,
			pluginName: service.provider.plugin?.name ?? service.provider.name,
			configured,
		};
	});
}
