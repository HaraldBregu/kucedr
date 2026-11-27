import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export function workspaceImages(): string {
	return path.join(userDataLocation(), 'settings', 'images');
}
