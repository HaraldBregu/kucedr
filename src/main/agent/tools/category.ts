export const toolCategoryRegistry = {
	core: {
		label: 'Core',
		description:
			'Read and modify workspace files, run commands, manage processes, and undo or redo file operations.',
	},
	system: {
		label: 'System',
		description:
			'Ask the user for required input and work with local device capabilities such as the microphone, camera, and screen.',
	},
	bootstrap: {
		label: 'Bootstrap',
		description:
			'Read and update the assistant identity, personality, user profile, and health context during initial setup.',
	},
	media: {
		label: 'Media',
		description:
			'Generate or edit images, create video, and produce audio or music from user instructions.',
	},
	task: {
		label: 'Tasks',
		description:
			'Create, inspect, update, delete, and immediately run scheduled background tasks.',
	},
	web: {
		label: 'Web',
		description:
			'Search the internet, retrieve page content, and interact with websites in a controlled browser.',
	},
	knowledge: {
		label: 'Knowledge',
		description:
			'Search configured knowledge sources for information relevant to the current request.',
	},
	skill: {
		label: 'Skills',
		description:
			'List and load reusable instruction packages that provide specialized workflows and capabilities.',
	},
	discovery: {
		label: 'Discovery',
		description:
			'Find relevant tools that are available to load on demand for the current model turn.',
	},
	integration: {
		label: 'Integrations',
		description:
			'Use tools supplied by connected apps and external services, including authorized MCP servers.',
	},
	delegation: {
		label: 'Delegation',
		description:
			'Delegate independent work to subagents or connected remote agents and follow their progress.',
	},
	goal: {
		label: 'Goals',
		description:
			'Create and track long-running goals, update their plans, record evidence, and report completion or blockers.',
	},
} as const;

export type ToolCategory = keyof typeof toolCategoryRegistry;
