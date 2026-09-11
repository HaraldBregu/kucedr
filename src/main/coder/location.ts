import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export function codingLocation(): string {
	return path.join(userDataLocation(), 'coder', 'pi');
}

export function codingSessionsLocation(): string {
	return path.join(codingLocation(), 'sessions');
}
