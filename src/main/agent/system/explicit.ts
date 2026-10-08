import type { Tool } from '../types';

export function requiresExplicitRequest(tool: Tool): boolean {
	return (
		['create_image', 'create_video', 'create_sound', 'microphone_recorder', 'camera_recorder', 'screen_recorder', 'select_screen_source', 'update_identity', 'update_soul', 'update_user', 'update_health', 'create_task', 'update_task', 'delete_task', 'run_task_now', 'delegate_a2a', 'cancel_a2a_task'].includes(tool.id)
	);
}
