import type { EventBus } from '../event_bus';
import type { Agent } from '../agent/agent';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { TaskChannels } from '../../shared/ipc_channels_definitions';
import {
	configureScheduleCapabilities,
	deleteSchedule,
	getSchedule,
	getRuntime,
	listSchedules,
	pauseSchedule,
	resumeSchedule,
	runScheduleNow,
	setRuntime,
} from '../tasks';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface TaskIpcDependencies {
	windows: WindowContextManager;
	apps: AppRegistry;
	agent: Agent;
}

export class TaskIpc implements IpcModule<TaskIpcDependencies> {
	readonly name = 'tasks';

	register({ windows, apps, agent }: TaskIpcDependencies, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		registerQueryWithEvent(TaskChannels.list, (event) => {
			trusted.assert(event);
			return listSchedules();
		});
		registerQueryWithEvent(TaskChannels.history, (event, scheduleId: string) => {
			trusted.assert(event);
			if (typeof scheduleId !== 'string') throw new Error('Invalid task schedule id.');
			const schedule = getSchedule(scheduleId);
			const sessionIds = new Set(schedule.sessionIds);
			return agent.listSessions('task').filter((session) => sessionIds.has(session.id));
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
