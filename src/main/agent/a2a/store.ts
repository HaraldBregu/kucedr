import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../../shared/user_data_location';
import type { A2aAgent } from '../../../shared/a2a_types';
import { isA2aSecureStorageAvailable } from './available';
import { openA2aAgent } from './open';
import { restrictA2aStorePermissions } from './permissions';
import { preserveA2aCredential } from './preserve';
import { sealA2aAgent } from './seal';
import type { A2aStoredAgent } from './stored';

const store = new Store<{ agents: A2aStoredAgent[] }>({
	name: 'a2a',
	cwd: path.resolve(userDataLocation(), 'settings'),
	accessPropertiesByDotNotation: false,
	defaults: { agents: [] },
});

let volatileCredentials = new Map<string, string>();
let preservedRecords = new Map<string, A2aStoredAgent>();

export const a2aStorePath = store.path;
export const getA2aAgents = (): A2aAgent[] => {
	const records = store.get('agents');
	const migratedRecords = [...records];
	const nextPreservedRecords = new Map<string, A2aStoredAgent>();
	let migrated = false;
	const agents = records.map((record, index) => {
		const opened = openA2aAgent(record, volatileCredentials.get(record.id));
		if (opened.encryptedCredentialUnreadable) nextPreservedRecords.set(record.id, record);
		if (opened.hasPlaintextCredential && isA2aSecureStorageAvailable()) {
			migratedRecords[index] = sealA2aAgent(opened.agent).record;
			migrated = true;
		} else if (opened.hasPlaintextCredential) {
			nextPreservedRecords.set(record.id, record);
		}
		return opened.agent;
	});
	preservedRecords = nextPreservedRecords;
	if (migrated) {
		store.set('agents', migratedRecords);
		restrictA2aStorePermissions(store.path);
	}
	return structuredClone(agents);
};
export const setA2aAgents = (agents: A2aAgent[]): void => {
	const nextVolatileCredentials = new Map<string, string>();
	const nextPreservedRecords = new Map<string, A2aStoredAgent>();
	const records = agents.map((agent) => {
		const preserved = preservedRecords.get(agent.id);
		const preservedRecord = preserved ? preserveA2aCredential(agent, preserved) : undefined;
		if (
			preservedRecord &&
			(!isA2aSecureStorageAvailable() || !agent.credential)
		) {
			nextPreservedRecords.set(agent.id, preservedRecord);
			return preservedRecord;
		}
		const sealed = sealA2aAgent(agent);
		if (sealed.volatileCredential) nextVolatileCredentials.set(agent.id, sealed.volatileCredential);
		return sealed.record;
	});
	volatileCredentials = nextVolatileCredentials;
	preservedRecords = nextPreservedRecords;
	store.set('agents', records);
	restrictA2aStorePermissions(store.path);
};
