import type { Config, Tool } from '../types';
import type { WindowFactory } from '../../window_factory';
import type { ExecSandbox } from '../sandbox';
import type { AgentInteractionMode } from '../../../shared/agent_types';
import { completeBootstrapTool } from '../tools/assistant/complete_bootstrap';
import { cancelA2aTaskTool } from '../tools/a2a/cancel';
import { delegateA2aTool } from '../tools/a2a/delegate';
import { getA2aTaskTool } from '../tools/a2a/get';
import { listA2aAgentsTool } from '../tools/a2a/list';
import { applyPatchTool } from '../tools/core/patch';
import { editTool } from '../tools/core/edit';
import { execTool } from '../tools/core/bash';
import { processTool } from '../tools/core/process';
import { readTool } from '../tools/core/read';
import { requestUserInputTool } from '../tools/core/ask';
import { writeTool } from '../tools/core/write';
import { closeAppsTool } from '../tools/apps/close_apps';
import { listAppsTool } from '../tools/apps/list_apps';
import { openAppsTool } from '../tools/apps/open_apps';
import { updateHealthSettingsTool } from '../tools/health/update_health_settings';
import { updateHealthTool } from '../tools/health/update_health';
import { getKnowledgeTools } from '../tools/knowledge';
import { forgetMemoryTool } from '../tools/memory/forget_memory';
import { listMemoriesTool } from '../tools/memory/list_memories';
import { saveMemoryTool } from '../tools/memory/save_memory';
import { createImageTool } from '../tools/media/create_image';
import { createSoundTool } from '../tools/media/create_sound';
import { createVideoTool } from '../tools/media/create_video';
import { speechToTextTool } from '../tools/media/speech_to_text';
import { textToSpeechTool } from '../tools/media/text_to_speech';
import { cameraRecorderTool } from '../tools/system/camera_recorder';
import { cameraRecorderStatusTool } from '../tools/system/camera_recorder_status';
import { cameraRecorderStopTool } from '../tools/system/camera_recorder_stop';
import { microphoneRecorderTool } from '../tools/system/microphone_recorder';
import { microphoneRecorderStatusTool } from '../tools/system/microphone_recorder_status';
import { microphoneRecorderStopTool } from '../tools/system/microphone_recorder_stop';
import { screenRecorderTool } from '../tools/system/screen_recorder';
import { screenRecorderStatusTool } from '../tools/system/screen_recorder_status';
import { screenRecorderStopTool } from '../tools/system/screen_recorder_stop';
import { selectScreenSourceTool } from '../tools/system/screen_source';
import { createTaskTool } from '../tools/tasks/create_task';
import { deleteTaskTool } from '../tools/tasks/delete_task';
import { getTaskTool } from '../tools/tasks/get_task';
import { listTasksTool } from '../tools/tasks/list_tasks';
import { pauseTaskTool } from '../tools/tasks/pause_task';
import { resumeTaskTool } from '../tools/tasks/resume_task';
import { runTaskNowTool } from '../tools/tasks/run_task_now';
import { updateTaskTool } from '../tools/tasks/update_task';
import { fetchWebPageTool } from '../tools/web/fetch_web_page';
import { getSearchWebTools } from '../tools/web/search_web';
import { useWebBrowserTool } from '../tools/web/use_web_browser';

export function builtinTools(
	config: Config,
	sandbox: ExecSandbox,
	windowFactory?: WindowFactory,
	interactionMode: AgentInteractionMode = 'default'
): Tool[] {
	return [
		listA2aAgentsTool,
		delegateA2aTool,
		getA2aTaskTool,
		cancelA2aTaskTool,
		readTool,
		...(interactionMode === 'plan' ? [requestUserInputTool] : []),
		writeTool,
		editTool,
		applyPatchTool,
		execTool(sandbox, interactionMode),
		processTool,
		...getSearchWebTools(),
		fetchWebPageTool,
		useWebBrowserTool,
		createImageTool(),
		createVideoTool(),
		createSoundTool(),
		textToSpeechTool(),
		speechToTextTool(),
		microphoneRecorderTool(),
		microphoneRecorderStatusTool,
		microphoneRecorderStopTool,
		cameraRecorderTool(),
		cameraRecorderStatusTool,
		cameraRecorderStopTool,
		screenRecorderTool(),
		...(interactionMode === 'default' ? [selectScreenSourceTool] : []),
		screenRecorderStatusTool,
		screenRecorderStopTool,
		saveMemoryTool(config),
		forgetMemoryTool(config),
		listMemoriesTool(config),
		...getKnowledgeTools(),
		updateHealthTool(config),
		updateHealthSettingsTool,
		createTaskTool,
		updateTaskTool,
		pauseTaskTool,
		resumeTaskTool,
		deleteTaskTool,
		getTaskTool,
		listTasksTool,
		runTaskNowTool,
		listAppsTool,
		...(windowFactory ? [openAppsTool(windowFactory)] : []),
		closeAppsTool,
		completeBootstrapTool,
	];
}
