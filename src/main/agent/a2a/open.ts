import { safeStorage } from 'electron';
import type { A2aAgent } from '../../../shared/a2a_types';
import { isA2aSecureStorageAvailable } from './available';
import type { A2aCredentialPayload, A2aStoredAgent } from './stored';

export function openA2aAgent(
	record: A2aStoredAgent,
	volatileCredential?: string
): { agent: A2aAgent; hasPlaintextCredential: boolean; encryptedCredentialUnreadable: boolean } {
	const data = { ...record };
	let credential = volatileCredential;
	let hasPlaintextCredential = false;
	let encryptedCredentialUnreadable = false;
	if (typeof data.credential === 'string' && data.credential.trim()) {
		credential = data.credential.trim();
		hasPlaintextCredential = true;
	} else if (typeof data.token === 'string' && data.token.trim()) {
		credential = data.token.trim();
		hasPlaintextCredential = true;
	}
	if (typeof data.encryptedCredential === 'string') {
		if (isA2aSecureStorageAvailable()) {
			try {
				const decrypted = safeStorage.decryptString(Buffer.from(data.encryptedCredential, 'base64'));
				let parsed: unknown;
				try {
					parsed = JSON.parse(decrypted);
				} catch {
					parsed = undefined;
				}
				if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
					const payload = parsed as A2aCredentialPayload;
					let origin = '';
					try {
						origin = new URL(data.url).origin;
					} catch {
						origin = '';
					}
					if (
						payload.version === 1 &&
						payload.agentId === data.id &&
						payload.origin === origin &&
						payload.authType === data.authType &&
						payload.apiKeyHeader === (data.apiKeyHeader ?? '') &&
						typeof payload.credential === 'string'
					) {
						credential = payload.credential;
					} else {
						encryptedCredentialUnreadable = true;
					}
				} else {
					credential = decrypted;
				}
			} catch {
				encryptedCredentialUnreadable = true;
			}
		} else {
			encryptedCredentialUnreadable = true;
		}
	}
	delete data.credential;
	delete data.token;
	delete data.encryptedCredential;
	const authType = data.authType ?? (credential ? 'bearer' : 'none');
	return {
		agent: { ...data, authType, ...(credential ? { credential } : {}) },
		hasPlaintextCredential,
		encryptedCredentialUnreadable,
	};
}
