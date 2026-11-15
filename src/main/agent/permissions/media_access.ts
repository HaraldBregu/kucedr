import { mediaDirectory } from '../../shared/media_directory';
import type { ToolAccess } from './permissions_types';

export function mediaAccess(directory?: string): ToolAccess {
	return { write: [mediaDirectory(directory)], folders: true, managed: directory === undefined };
}
