export const toolCategoryRegistry = {
	workspace: { label: 'Workspace', description: 'Read, edit, and run work in the workspace.' },
	system: { label: 'System', description: 'Interact with the user and local device capabilities.' },
	bootstrap: {
		label: 'Bootstrap',
		description: 'Read and update the assistant profile during initial setup.',
	},
	media: { label: 'Media', description: 'Create and edit images, video, and audio.' },
	task: { label: 'Tasks', description: 'Create, manage, and run scheduled tasks.' },
	web: { label: 'Web', description: 'Search, retrieve, and interact with web content.' },
	knowledge: { label: 'Knowledge', description: 'Search configured knowledge sources.' },
	skill: { label: 'Skills', description: 'Find and load reusable instructions and capabilities.' },
	discovery: { label: 'Discovery', description: 'Find tools that can be loaded on demand.' },
	integration: { label: 'Integrations', description: 'Use tools provided by connected services.' },
	delegation: { label: 'Delegation', description: 'Delegate and coordinate work with other agents.' },
	goal: { label: 'Goals', description: 'Track and update long-running goals.' },
} as const;

export type ToolCategory = keyof typeof toolCategoryRegistry;
