import type { Config, Tool } from '../types';
import type { ExecSandbox } from '../sandbox';
import { completeBootstrapTool } from '../tools/assistant/complete_bootstrap';
import { applyPatchTool } from '../tools/core/patch';
import { editTool } from '../tools/core/edit';
import { execTool } from '../tools/core/bash';
import { processTool } from '../tools/core/process';
import { readTool } from '../tools/core/read';
import { requestUserInputTool } from '../tools/system/ask';
import { writeTool } from '../tools/core/write';
import { getKnowledgeTools } from '../tools/knowledge';
import { getIdentityTool } from '../tools/identity/get';
import { getSoulTool } from '../tools/soul/get';
import { updateSoulTool } from '../tools/soul/update';
import { getUserTool } from '../tools/user/get';
import { updateUserTool } from '../tools/user/update';
import { updateIdentityTool } from '../tools/identity/update';
import { getHealthTool } from '../tools/health/get';
import { runScript } from '../tools/plugin/run';
import { loadScript } from '../tools/plugin/load';
import { pluginScripts } from '../../plugins';
import { updateHealthTool } from '../tools/health/update';
import { modelTools } from '../tools/model/tools';
import { createImageTool } from '../tools/media/create_image';
import { createSoundTool } from '../tools/media/create_sound';
import { createVideoTool } from '../tools/media/create_video';
import { recorderTools } from '../tools/system/recorder';
import { selectScreenSourceTool } from '../tools/system/screen_source';
import { createTaskTool } from '../tools/tasks/create_task';
import { deleteTaskTool } from '../tools/tasks/delete_task';
import { listTasksTool } from '../tools/tasks/list_tasks';
import { runTaskNowTool } from '../tools/tasks/run_task_now';
import { updateTaskTool } from '../tools/tasks/update_task';
import { fetchWebPageTool } from '../tools/web/fetch_web_page';
import { getSearchWebTools } from '../tools/web/search_web';
import { useWebBrowserTool } from '../tools/web/use_web_browser';

export function builtinTools(
	config: Config,
	sandbox: ExecSandbox,
	limits: { ask?: boolean; readOnlyShell?: boolean; restricted?: boolean } = {}
): Tool[] {
	const microphone = recorderTools('microphone');
	const camera = recorderTools('camera');
	const screen = recorderTools('screen');
	return [
		readTool,
		...(limits.ask === false ? [] : [requestUserInputTool]),
		writeTool,
		editTool,
		applyPatchTool,
		execTool(sandbox, limits.readOnlyShell === true),
		processTool,
		...getSearchWebTools(),
		fetchWebPageTool,
		useWebBrowserTool,
		...modelTools(),
		createImageTool(),
		createVideoTool(),
		createSoundTool(),
		...(pluginScripts().length > 0 ? [loadScript, runScript] : []),
		microphone.start,
		microphone.status,
		microphone.stop,
		camera.start,
		camera.status,
		camera.stop,
		screen.start,
		...(limits.restricted ? [] : [selectScreenSourceTool]),
		screen.status,
		screen.stop,
		...getKnowledgeTools(),
		getIdentityTool,
		getSoulTool,
		updateSoulTool,
		getUserTool,
		updateUserTool,
		updateIdentityTool,
		getHealthTool(config),
		updateHealthTool(config),
		createTaskTool,
		updateTaskTool,
		deleteTaskTool,
		listTasksTool,
		runTaskNowTool,
		completeBootstrapTool,
	];
}
