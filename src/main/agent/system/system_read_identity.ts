import { getIdentity, type IdentitySettings } from '../../identity';

export function readIdentity(workspacePath: string): Promise<IdentitySettings | null> {
	return getIdentity(workspacePath);
}
