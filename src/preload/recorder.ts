import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import { RecorderChannels } from '../shared/ipc_channels_definitions';
import type { RecorderApi } from './index.d';

export const recorder: RecorderApi = {
	microphone: {
		complete: (result) => typedInvokeUnwrap(RecorderChannels.microphone.complete, result),
		chunk: (chunk) => typedInvokeUnwrap(RecorderChannels.microphone.chunk, chunk),
		onCommand: (callback) => typedOn(RecorderChannels.microphone.command, callback),
		onEvent: (callback) => typedOn(RecorderChannels.microphone.event, callback),
	},
	camera: {
		complete: (result) => typedInvokeUnwrap(RecorderChannels.camera.complete, result),
		chunk: (chunk) => typedInvokeUnwrap(RecorderChannels.camera.chunk, chunk),
		onCommand: (callback) => typedOn(RecorderChannels.camera.command, callback),
		onEvent: (callback) => typedOn(RecorderChannels.camera.event, callback),
	},
	screen: {
		complete: (result) => typedInvokeUnwrap(RecorderChannels.screen.complete, result),
		chunk: (chunk) => typedInvokeUnwrap(RecorderChannels.screen.chunk, chunk),
		onCommand: (callback) => typedOn(RecorderChannels.screen.command, callback),
		onEvent: (callback) => typedOn(RecorderChannels.screen.event, callback),
	},
};
