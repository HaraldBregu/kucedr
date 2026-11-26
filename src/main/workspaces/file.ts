import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export function workspacesFile(): string {
	return path.join(userDataLocation(), 'workspaces', 'workspaces.json');
}
