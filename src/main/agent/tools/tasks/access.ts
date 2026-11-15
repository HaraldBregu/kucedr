import { taskStorePath } from '../../../tasks/tasks_store';
import type { ToolAccess } from '../../permissions';

export function taskAccess(): ToolAccess {
	return { write: [taskStorePath], managed: true };
}
