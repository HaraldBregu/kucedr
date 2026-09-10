import { shell } from 'electron';
import path from 'node:path';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { TaskChannels } from '../../shared/ipc_channels_definitions';
import {
	configureScheduleCapabilities,
	deleteSchedule,
	getRuntime,
	listTaskHistory,
	listSchedules,
	pauseSchedule,
	resumeSchedule,
	runScheduleNow,
	setRuntime,
} from '../tasks';
import { taskStorePath } from '../tasks/tasks_store';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface TaskIpcDependencies {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class TaskIpc implements IpcModule<TaskIpcDependencies> {
	readonly name = 'tasks';

	register({ windows, apps }: TaskIpcDependencies, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		registerQueryWithEvent(TaskChannels.list, (event) => {
			trusted.assert(event);
			return listSchedules();
		});
		registerQueryWithEvent(TaskChannels.history, (event, scheduleId: string) => {
			trusted.assert(event);
			if (typeof scheduleId !== 'string') throw new Error('Invalid task schedule id.');
			return listTaskHistory(scheduleId);
		});
		registerCommandWithEvent(TaskChannels.openFolder, async (event): Promise<void> => {
			trusted.assert(event);
			const error = await shell.openPath(path.dirname(taskStorePath));
			if (error) throw new Error(error);
		});
		registerCommandWithEvent(TaskChannels.runNow, (event, scheduleId: string) => {
			trusted.assert(event);
			if (typeof scheduleId !== 'string') throw new Error('Invalid task schedule id.');
			return runScheduleNow(scheduleId);
		});
		registerCommandWithEvent(TaskChannels.delete, (event, scheduleId: string) => {
			trusted.assert(event);
			if (typeof scheduleId !== 'string') throw new Error('Invalid task schedule id.');
			return deleteSchedule(scheduleId);
		});
		registerCommandWithEvent(
			TaskChannels.setEnabled,
			(event, scheduleId: string, enabled: boolean) => {
				trusted.assert(event);
				if (typeof scheduleId !== 'string' || typeof enabled !== 'boolean') {
					throw new Error('Invalid task schedule configuration.');
				}
				return enabled ? resumeSchedule(scheduleId) : pauseSchedule(scheduleId);
			}
		);
		registerQueryWithEvent(TaskChannels.getRuntime, (event) => {
			trusted.assert(event);
			return getRuntime();
		});
		registerCommandWithEvent(
			TaskChannels.setRuntime,
			(event, providerId: string, modelId: string) => {
				trusted.assert(event);
				return setRuntime(providerId, modelId);
			}
		);
		registerCommandWithEvent(
			TaskChannels.configureCapabilities,
			(event, scheduleId: string, enabled: boolean, toolsAllow: string[]) => {
				trusted.assert(event);
				if (
					typeof scheduleId !== 'string' ||
					typeof enabled !== 'boolean' ||
					!Array.isArray(toolsAllow)
				)
					throw new Error('Invalid schedule capability configuration.');
				return configureScheduleCapabilities(scheduleId, enabled, toolsAllow);
			}
		);
	}
}
