import { completeBootstrapTool } from '../../../../../src/main/agent/tools/assistant/complete_bootstrap';
import { editTool } from '../../../../../src/main/agent/tools/core/edit';
import { updateHealthSettingsTool } from '../../../../../src/main/agent/tools/health/update_health_settings';
import { updateHealthTool } from '../../../../../src/main/agent/tools/health/update_health';
import { createImageTool } from '../../../../../src/main/agent/tools/media/create_image';
import { createSoundTool } from '../../../../../src/main/agent/tools/media/create_sound';
import { createVideoTool } from '../../../../../src/main/agent/tools/media/create_video';
import { speechToTextTool } from '../../../../../src/main/agent/tools/media/speech_to_text';
import { textToSpeechTool } from '../../../../../src/main/agent/tools/media/text_to_speech';
import { forgetMemoryTool } from '../../../../../src/main/agent/tools/memory/forget_memory';
import { saveMemoryTool } from '../../../../../src/main/agent/tools/memory/save_memory';
import { cameraRecorderTool } from '../../../../../src/main/agent/tools/system/camera_recorder';
import { microphoneRecorderTool } from '../../../../../src/main/agent/tools/system/microphone_recorder';
import { screenRecorderTool } from '../../../../../src/main/agent/tools/system/screen_recorder';
import { createTaskTool } from '../../../../../src/main/agent/tools/tasks/create_task';
import { deleteTaskTool } from '../../../../../src/main/agent/tools/tasks/delete_task';
import { getTaskTool } from '../../../../../src/main/agent/tools/tasks/get_task';
import { listTasksTool } from '../../../../../src/main/agent/tools/tasks/list_tasks';
import { pauseTaskTool } from '../../../../../src/main/agent/tools/tasks/pause_task';
import { resumeTaskTool } from '../../../../../src/main/agent/tools/tasks/resume_task';
import { runTaskNowTool } from '../../../../../src/main/agent/tools/tasks/run_task_now';
import { updateTaskTool } from '../../../../../src/main/agent/tools/tasks/update_task';
import { ingestWikiSourceTool } from '../../../../../src/main/agent/tools/knowledge/ingest_wiki_source';
import { lintWikiTool } from '../../../../../src/main/agent/tools/knowledge/lint_wiki';
import { readWikiPageTool } from '../../../../../src/main/agent/tools/knowledge/read_wiki_page';
import { rebuildWikiIndexTool } from '../../../../../src/main/agent/tools/knowledge/rebuild_wiki_index';
import { reviewWikiChangesTool } from '../../../../../src/main/agent/tools/knowledge/review_wiki_changes';
import { saveWikiAnalysisTool } from '../../../../../src/main/agent/tools/knowledge/save_wiki_analysis';
import { searchWikiTool } from '../../../../../src/main/agent/tools/knowledge/search_wiki';
import { queryWikiTool } from '../../../../../src/main/agent/tools/knowledge/query_wiki';
import { useWebBrowserTool } from '../../../../../src/main/agent/tools/web/use_web_browser';

it.each([
	updateHealthTool({ location: '/workspace' }),
	updateHealthSettingsTool,
	completeBootstrapTool,
	ingestWikiSourceTool,
	saveWikiAnalysisTool,
	lintWikiTool,
	reviewWikiChangesTool,
	rebuildWikiIndexTool,
	createImageTool(),
	createVideoTool(),
	createSoundTool(),
	textToSpeechTool(),
	speechToTextTool(),
	microphoneRecorderTool(),
	cameraRecorderTool(),
	screenRecorderTool(),
	saveMemoryTool({ location: '/workspace' }),
	forgetMemoryTool({ location: '/workspace' }),
	useWebBrowserTool,
])('%s uses policy permission without forced approval', (tool) => {
	expect(tool.hardApproval).toBeUndefined();
	expect(tool.alwaysAsk).toBeUndefined();
});

it.each([searchWikiTool, readWikiPageTool, queryWikiTool])(
	'%s is safe to expose in plan mode',
	(tool) => {
		expect(tool.planSafe).toBe(true);
		expect(tool.hardApproval).toBeUndefined();
	}
);

it.each([
	createTaskTool,
	updateTaskTool,
	deleteTaskTool,
	pauseTaskTool,
	resumeTaskTool,
	runTaskNowTool,
])('%s uses its scoped permission without forced approval', (tool) => {
	expect(tool.hardApproval).not.toBe(true);
});

it.each([
	['create_task', createTaskTool],
	['update_task', updateTaskTool],
	['delete_task', deleteTaskTool],
	['get_task', getTaskTool],
	['list_tasks', listTasksTool],
	['pause_task', pauseTaskTool],
	['resume_task', resumeTaskTool],
	['run_task_now', runTaskNowTool],
] as const)('exports the %s tool from its matching module', (name, taskTool) => {
	expect(taskTool.id).toBe(name);
});

it('uses taskId in task tool inputs', () => {
	expect(deleteTaskTool.parseInput({ taskId: 'task-1' })).toEqual({ taskId: 'task-1' });
	expect(() => deleteTaskTool.parseInput({ scheduleId: 'task-1' })).toThrow();
});

it('uses ordinary policy approval for focused text edits', () => {
	expect(editTool.id).toBe('edit');
	expect(editTool.hardApproval).not.toBe(true);
});

it('allows wiki lint to use its ordinary policy', () => {
	expect(lintWikiTool.id).toBe('lint_wiki');
	expect(lintWikiTool.hardApproval).toBeUndefined();
});
