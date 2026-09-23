import path from 'node:path';
import { userDataLocation } from '../../shared/user_data_location';

export function storageLocation(): string {
	return path.join(userDataLocation(), 'storage');
}
