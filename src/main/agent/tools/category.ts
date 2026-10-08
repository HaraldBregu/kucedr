export const toolCategoryRegistry = {
	workspace: { label: 'Workspace' },
	system: { label: 'System' },
	bootstrap: { label: 'Bootstrap' },
	media: { label: 'Media' },
	task: { label: 'Tasks' },
	web: { label: 'Web' },
	knowledge: { label: 'Knowledge' },
	skill: { label: 'Skills' },
	discovery: { label: 'Discovery' },
	integration: { label: 'Integrations' },
	delegation: { label: 'Delegation' },
	goal: { label: 'Goals' },
} as const;

export type ToolCategory = keyof typeof toolCategoryRegistry;
