import { getUser, type UserSettings } from '../../user';

export function readUser(workspacePath: string): Promise<UserSettings | null> {
	return getUser(workspacePath);
}
