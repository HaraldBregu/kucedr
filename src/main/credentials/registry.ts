import type { CredentialSelection } from './selection';
import type { CredentialService } from './service';

/** Set once at bootstrap so provider resolution can reach each plugin's active cloud key. */
export const credentialRegistry: { service?: CredentialService; selection?: CredentialSelection } = {};
