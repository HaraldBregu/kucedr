import { getIdentity } from '../../identity';

export function readIdentity(workspacePath: string): Promise<string> {
	return getIdentity(workspacePath);
}
