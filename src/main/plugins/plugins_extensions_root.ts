import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export function extensionsRoot(location = userDataLocation()): string {
	return path.join(location, 'extensions');
}
