import { executionScope } from '../../../../../src/main/agent/execution/scope';
import { recordingOwners } from '../../../../../src/main/agent/recordings/store';
import type { Tool } from '../../../../../src/main/agent/types';
import { desktopCapturer } from 'electron';
const scope = {
	ownerId: 'interactive:session',
	source: 'interactive' as const,
	sessionId: 'session',
	runId: 'run',
};
const ownedRun = (tool: Tool, input: Record<string, unknown>, signal?: AbortSignal) =>
	executionScope.run(scope, () => tool.run(input, signal));

const microphone = { start: jest.fn(), stop: jest.fn(), cancel: jest.fn(), get: jest.fn() };
const camera = { start: jest.fn(), stop: jest.fn(), cancel: jest.fn(), get: jest.fn() };
const screen = { start: jest.fn(), stop: jest.fn(), cancel: jest.fn(), get: jest.fn() };

jest.mock('../../../../../src/main/recorder', () => ({ microphone, camera, screen }));
jest.mock('../../../../../src/main/shared/agent_location', () => ({
	agentLocation: () => '/workspace',
}));
jest.mock('../../../../../src/main/shared/user_path', () => ({
	resolveUserPath: () => '/workspace',
}));

import { cameraRecorderTool } from '../../../../../src/main/agent/tools/system/camera_recorder';
import { cameraRecorderStatusTool } from '../../../../../src/main/agent/tools/system/camera_recorder_status';
import { cameraRecorderStopTool } from '../../../../../src/main/agent/tools/system/camera_recorder_stop';
import { microphoneRecorderTool } from '../../../../../src/main/agent/tools/system/microphone_recorder';
import { microphoneRecorderStatusTool } from '../../../../../src/main/agent/tools/system/microphone_recorder_status';
import { microphoneRecorderStopTool } from '../../../../../src/main/agent/tools/system/microphone_recorder_stop';
import { screenRecorderTool } from '../../../../../src/main/agent/tools/system/screen_recorder';
import { screenRecorderStatusTool } from '../../../../../src/main/agent/tools/system/screen_recorder_status';
import { screenRecorderStopTool } from '../../../../../src/main/agent/tools/system/screen_recorder_stop';

const id = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
	jest.clearAllMocks();
	jest.mocked(desktopCapturer.getSources).mockResolvedValue([{ id: 'screen:1', name: 'Screen 1' }] as never);
	for (const recorder of [microphone, camera, screen]) {
		recordingOwners.delete(recorder as never);
		recorder.start.mockReturnValue({
			id,
			url: '/workspace/capture.webm',
			status: 'recording',
			duration: 1_000,
		});
		recorder.get.mockReturnValue({
			id,
			url: '/workspace/capture.webm',
			status: 'recording',
			duration: 1_000,
		});
	}
});

it.each([
	['microphone_recorder', microphoneRecorderTool()],
	['microphone_recorder_status', microphoneRecorderStatusTool],
	['microphone_recorder_stop', microphoneRecorderStopTool],
	['camera_recorder', cameraRecorderTool()],
	['camera_recorder_status', cameraRecorderStatusTool],
	['camera_recorder_stop', cameraRecorderStopTool],
	['screen_recorder', screenRecorderTool()],
	['screen_recorder_status', screenRecorderStatusTool],
	['screen_recorder_stop', screenRecorderStopTool],
] as const)('exports the %s tool from its matching module', (name, recorderTool) => {
	expect(recorderTool.id).toBe(name);
});

it.each([
	['microphone', microphoneRecorderTool, microphone],
	['camera', cameraRecorderTool, camera],
	['screen', screenRecorderTool, screen],
] as const)(
	'allows and cancels an owned %s recording with the run',
	async (_name, createTool, recorder) => {
		const controller = new AbortController();
		const captureTool = createTool();

		await ownedRun(
			captureTool,
			{ duration: 1, filename: 'capture.webm', ...(_name === 'screen' ? { sourceId: 'screen:1' } : {}) },
			controller.signal
		);
		controller.abort();

		expect(captureTool.id).toBe(`${_name}_recorder`);
		expect(captureTool.hardApproval).toBeUndefined();
		expect(recorder.cancel).toHaveBeenCalledWith(id);
	}
);

it('lists screen sources before starting a screen recording', async () => {
	jest.mocked(desktopCapturer.getSources).mockResolvedValue([
		{ id: 'screen:1', name: 'Display 1' },
		{ id: 'window:2', name: 'Kucedr' },
	] as never);

	await expect(ownedRun(screenRecorderTool(), {})).resolves.toEqual({
		status: 'selection_required',
		sources: [
			{ id: 'screen:1', name: 'Display 1', type: 'screen' },
			{ id: 'window:2', name: 'Kucedr', type: 'window' },
		],
	});
	expect(screen.start).not.toHaveBeenCalled();
});

it('reports when no screen source is available', async () => {
	jest.mocked(desktopCapturer.getSources).mockResolvedValue([] as never);

	await expect(ownedRun(screenRecorderTool(), {})).rejects.toThrow(
		'No display or window is available to record.'
	);
	expect(screen.start).not.toHaveBeenCalled();
});

it.each([
	['microphone', microphoneRecorderTool, microphone],
	['camera', cameraRecorderTool, camera],
	['screen', screenRecorderTool, screen],
] as const)(
	'starts an owned %s recording until explicitly stopped when duration is omitted',
	async (_name, createTool, recorder) => {
		await ownedRun(
			createTool(),
			{ filename: 'capture.webm', ...(_name === 'screen' ? { sourceId: 'screen:1' } : {}) }
		);

		expect(recorder.start).toHaveBeenCalledWith({
			url: '/workspace/capture.webm',
			...(_name === 'screen' ? { sourceId: 'screen:1' } : {}),
		});
	}
);

it.each([
	['microphone_recorder_stop', microphoneRecorderStopTool, microphone],
	['camera_recorder_stop', cameraRecorderStopTool, camera],
	['screen_recorder_stop', screenRecorderStopTool, screen],
] as const)('provides the explicit %s tool', async (name, stopTool, recorder) => {
	recordingOwners.set(recorder as never, new Map([[id, scope]]));
	await expect(ownedRun(stopTool, { id })).resolves.toMatchObject({ id, status: 'recording' });
	expect(stopTool.id).toBe(name);
	expect(recorder.stop).toHaveBeenCalledWith(id);
});


it.each([
	[microphoneRecorderTool, microphoneRecorderStatusTool, microphoneRecorderStopTool, microphone, {}],
	[cameraRecorderTool, cameraRecorderStatusTool, cameraRecorderStopTool, camera, {}],
	[screenRecorderTool, screenRecorderStatusTool, screenRecorderStopTool, screen, { sourceId: 'screen:1' }],
] as const)(
	'prevents other sessions from inspecting or stopping owned recordings',
	async (create, status, stop, recorder, input) => {
		await ownedRun(create(), { duration: 1, ...input });
		const foreign = { ...scope, sessionId: 'other' };
		await expect(executionScope.run(foreign, () => status.run({ id }))).rejects.toThrow(
			'not owned'
		);
		await expect(executionScope.run(foreign, () => stop.run({ id }))).rejects.toThrow('not owned');
		expect(recorder.stop).not.toHaveBeenCalled();
		await expect(ownedRun(status, { id })).resolves.toMatchObject({ id });
	}
);

it('does not start recording without an execution owner', async () => {
	await expect(cameraRecorderTool().run({ duration: 1 })).rejects.toThrow('owning session');
	expect(camera.start).not.toHaveBeenCalled();
});
