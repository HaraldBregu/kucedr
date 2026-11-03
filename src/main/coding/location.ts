import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export function codingSessionsLocation(): string {
	return path.join(userDataLocation(), 'coder', 'sessions');
}
