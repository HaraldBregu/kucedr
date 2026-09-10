import { typedInvokeUnwrap } from '../shared/ipc_types';
import { TaskChannels } from '../shared/ipc_channels_definitions';
import type { TaskApi } from './index.d';

export const tasks: TaskApi = {
	list: () => {
		return typedInvokeUnwrap(TaskChannels.list);
	},
	history: (scheduleId: string) => {
		return typedInvokeUnwrap(TaskChannels.history, scheduleId);
	},
	openFolder: () => {
		return typedInvokeUnwrap(TaskChannels.openFolder);
	},
	runNow: (scheduleId: string) => {
		return typedInvokeUnwrap(TaskChannels.runNow, scheduleId);
	},
	delete: (scheduleId: string) => {
		return typedInvokeUnwrap(TaskChannels.delete, scheduleId);
	},
	setEnabled: (scheduleId: string, enabled: boolean) => {
		return typedInvokeUnwrap(TaskChannels.setEnabled, scheduleId, enabled);
	},
	getRuntime: () => {
		return typedInvokeUnwrap(TaskChannels.getRuntime);
	},
	setRuntime: (providerId: string, modelId: string) => {
		return typedInvokeUnwrap(TaskChannels.setRuntime, providerId, modelId);
	},
	configureCapabilities: (scheduleId: string, enabled: boolean, toolsAllow: string[]) => {
		return typedInvokeUnwrap(TaskChannels.configureCapabilities, scheduleId, enabled, toolsAllow);
	},
};
