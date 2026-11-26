import { DEFAULT_WORKSPACE } from '@shared/workspaces_types';
import { active } from './active';

export function scoped(key: string, id = active.id): string {
	return id === DEFAULT_WORKSPACE ? key : `${key}@${id}`;
}
