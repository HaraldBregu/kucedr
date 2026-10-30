import type { CredentialService } from './service';

/** Set once at bootstrap so provider resolution can reach the signed-in credential gateway. */
export const credentialRegistry: { service?: CredentialService } = {};
