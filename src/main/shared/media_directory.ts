import { agentLocation } from './agent_location';
import { libraryLocation } from './library_location';
import { resolveUserPath } from './user_path';

export function mediaDirectory(directory?: string, workspace = agentLocation()): string {
	return directory === undefined ? libraryLocation() : resolveUserPath(directory, workspace);
}
