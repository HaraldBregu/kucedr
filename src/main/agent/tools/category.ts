export const toolCategoryRegistry = {
	core: { label: 'Core' },
	system: { label: 'System' },
	bootstrap: { label: 'Bootstrap' },
	media: { label: 'Media' },
	task: { label: 'Tasks' },
	web: { label: 'Web' },
	knowledge: { label: 'Knowledge' },
	skill: { label: 'Skills' },
	integration: { label: 'Integrations' },
	delegation: { label: 'Delegation' },
} as const;

export type ToolCategory = keyof typeof toolCategoryRegistry;
