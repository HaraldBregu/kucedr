import {
	BookOpen,
	FileText,
	Globe,
	HeartPulse,
	Image as ImageIcon,
	ListTodo,
	Monitor,
	Network,
	Settings,
	Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type AgentTool = readonly [name: string, id: string, description: string];

type AgentToolGroup = {
	readonly titleKey: string;
	readonly icon: LucideIcon;
	readonly tools: readonly AgentTool[];
};

const AGENT_TOOL_GROUPS: readonly AgentToolGroup[] = [
	{
		titleKey: 'coordination',
		icon: Network,
		tools: [
			['Subagent', 'subagent', 'Starts up to three subagents for focused tasks.'],
		],
	},
	{
		titleKey: 'core',
		icon: FileText,
		tools: [
			['Read file', 'read', 'Reads file contents from the workspace.'],
			['Write file', 'write', 'Creates or replaces a file in the workspace.'],
			['Edit file', 'edit', 'Makes a targeted text edit to an existing file.'],
			['Apply patch', 'patch', 'Applies a structured patch to one or more files.'],
			['Undo file operation', 'undo', 'Reverts the most recent tracked file operation.'],
			['Redo file operation', 'redo', 'Reapplies a previously undone file operation.'],
			['Execute command', 'bash', 'Runs a shell command in the workspace.'],
			['Manage process', 'process', 'Inspects, waits for, or stops managed processes.'],
		],
	},
	{
		titleKey: 'web',
		icon: Globe,
		tools: [
			['Fetch web page', 'fetch_web_page', 'Retrieves and reads a web page by URL.'],
			[
				'Use web browser',
				'use_web_browser',
				'Controls a browser to navigate and interact with websites.',
			],
		],
	},
	{
		titleKey: 'media',
		icon: ImageIcon,
		tools: [
			['Create image', 'create_image', 'Generates or edits an image from instructions.'],
			['Create video', 'create_video', 'Generates a video from instructions.'],
			['Create sound', 'create_sound', 'Generates audio or music from instructions.'],
		],
	},
	{
		titleKey: 'recording',
		icon: Monitor,
		tools: [
			['Microphone recorder', 'microphone_recorder', 'Starts recording microphone audio.'],
			[
				'Microphone recorder status',
				'microphone_recorder_status',
				'Reports the state of a microphone recording.',
			],
			[
				'Microphone recorder stop',
				'microphone_recorder_stop',
				'Stops a microphone recording and returns the audio.',
			],
			['Camera recorder', 'camera_recorder', 'Starts recording from a camera.'],
			[
				'Camera recorder status',
				'camera_recorder_status',
				'Reports the state of a camera recording.',
			],
			[
				'Camera recorder stop',
				'camera_recorder_stop',
				'Stops a camera recording and returns the video.',
			],
			['Screen recorder', 'screen_recorder', 'Starts recording a selected screen or window.'],
			[
				'Select screen source',
				'select_screen_source',
				'Lets the user choose the screen or window to record.',
			],
			[
				'Screen recorder status',
				'screen_recorder_status',
				'Reports the state of a screen recording.',
			],
			[
				'Screen recorder stop',
				'screen_recorder_stop',
				'Stops a screen recording and returns the video.',
			],
		],
	},
	{
		titleKey: 'knowledge',
		icon: BookOpen,
		tools: [
			[
				'Query knowledge',
				'query_knowledge',
				'Searches the selected knowledge for relevant content.',
			],
		],
	},
	{
		titleKey: 'tasks',
		icon: ListTodo,
		tools: [
			['Create task', 'create_task', 'Creates a scheduled background task.'],
			['Update task', 'update_task', 'Changes an existing scheduled task.'],
			['Delete task', 'delete_task', 'Permanently removes a scheduled task.'],
			['List tasks', 'list_tasks', 'Lists scheduled tasks.'],
			['Run task now', 'run_task_now', 'Runs a scheduled task immediately.'],
		],
	},
	{
		titleKey: 'health',
		icon: HeartPulse,
		tools: [
			['Get health', 'get_health', 'Reads the current HEALTH.md information.'],
			['Update health', 'update_health', 'Replaces the current HEALTH.md information.'],
		],
	},
	{
		titleKey: 'skills',
		icon: Sparkles,
		tools: [
			['List skills', 'list_skills', 'Lists skills that can extend the current run.'],
			['Load skill', 'load_skill', 'Loads a skill and its allowed tools for the current run.'],
		],
	},
	{
		titleKey: 'system',
		icon: Settings,
		tools: [
			['Get soul', 'get_soul', 'Reads the assistant personality and interaction style.'],
			['Update soul', 'update_soul', 'Updates the assistant soul with structured fields.'],
			['Get user', 'get_user', 'Reads the user profile.'],
			['Update user', 'update_user', 'Updates the user profile with structured fields.'],
			['Remember', 'remember', 'Saves a fact to memory when the user asks.'],
			['Forget', 'forget', 'Deletes matching facts from memory when the user asks.'],
			['Get identity', 'get_identity', 'Reads the assistant identity.'],
			[
				'Update identity',
				'update_identity',
				'Updates the assistant identity with structured fields.',
			],
			['Request user input', 'ask', 'Asks the user for information needed to continue.'],
			['Complete bootstrap', 'complete_bootstrap', 'Marks initial agent setup as complete.'],
		],
	},
] as const;

export const ORDERED_AGENT_TOOL_GROUPS = [
	'system',
	'core',
	'web',
	'media',
	'recording',
	'knowledge',
	'skills',
	'tasks',
	'health',
	'coordination',
].map((titleKey) => AGENT_TOOL_GROUPS.find((group) => group.titleKey === titleKey)!);
