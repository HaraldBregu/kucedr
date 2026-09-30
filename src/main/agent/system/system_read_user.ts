import { getUser } from '../../user';

export function readUser(workspacePath: string): Promise<string> {
	return getUser(workspacePath);
}
