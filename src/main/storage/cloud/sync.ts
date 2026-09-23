import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoragePullResult, StoragePushResult } from '../../../shared/storage_types';
import { getStorageSettings } from '../../settings_store';
import type { AuthService } from '../../cloud/service';
import { getOrCreateDeviceId } from '../local/device';
import { migrateLegacyStorageSettings } from '../local/migrate';
import { openStorageState } from '../local/state';
import { getOrCreateWorkspaceId } from '../local/workspace';
import { StorageCloudApi } from './api';
import { catchUp } from './catchup';
import { configureVersionedStorage } from './configure';
import { drainPending } from './drain';
import { scanWorkspace } from './scan';

export function runVersionedStorageSync(
	client: SupabaseClient, auth: AuthService, projectUrl: string, mode: 'backup'
): Promise<StoragePushResult>;
export function runVersionedStorageSync(
	client: SupabaseClient, auth: AuthService, projectUrl: string, mode: 'restore'
): Promise<StoragePullResult>;
export async function runVersionedStorageSync(
	client: SupabaseClient,
	auth: AuthService,
	projectUrl: string,
	mode: 'backup' | 'restore'
): Promise<StoragePushResult | StoragePullResult> {
	const accountId = auth.getSignedInUserId();
	if (!accountId) throw new Error('Sign in before synchronizing files.');
	const settings = getStorageSettings();
	const config = await configureVersionedStorage(settings, projectUrl);
	if (!config.sync.enabled) throw new Error('Cloud file synchronization is disabled.');
	const database = openStorageState();
	const cloud = new StorageCloudApi(client);
	const uploaded: string[] = [];
	const downloaded: string[] = [];
	const failed: Array<{ path: string; error: string }> = [];
	try {
		await migrateLegacyStorageSettings(database);
		const deviceId = getOrCreateDeviceId(database);
		for (const workspace of config.workspaces) {
			if (!settings.paths.includes(workspace.rootPath)) continue;
			const scope = {
				accountId,
				workspaceId: getOrCreateWorkspaceId(database, accountId,
					workspace.rootPath, workspace.id),
			};
			try {
				if (mode === 'backup') {
					uploaded.push(...await scanWorkspace(database, scope, workspace.rootPath, deviceId));
					const result = await drainPending(database, scope, cloud);
					if (result.failed) throw new Error(`${result.failed} file version(s) remain pending.`);
				}
				const applied = await catchUp(database, scope, cloud);
				if (applied) downloaded.push(workspace.rootPath);
			} catch (error) {
				failed.push({ path: workspace.rootPath,
					error: error instanceof Error ? error.message : 'Cloud sync failed.' });
			}
		}
		return mode === 'backup' ? { uploaded, failed } : { downloaded, skipped: [], failed };
	} finally {
		database.close();
	}
}
