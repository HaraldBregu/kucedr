import i18n from '@/i18n';

const TASK_COMMANDS: Record<string, (rest: string) => string> = {
	'/task_list': () => i18n.t('taskCommands.list'),
	'/create_task': (rest) =>
		rest ? i18n.t('taskCommands.create', { message: rest }) : i18n.t('taskCommands.createEmpty'),
	'/delete_task': (rest) =>
		rest ? i18n.t('taskCommands.delete', { message: rest }) : i18n.t('taskCommands.deleteEmpty'),
};

export function expandTaskCommand(prompt: string): string {
	// The editor emits markdown, which escapes underscores: "/task\_list".
	const match = /^(\/(?:\w|\\_)+)\s*([\s\S]*)$/.exec(prompt);
	if (!match) return prompt;
	const expand = TASK_COMMANDS[match[1].replaceAll('\\', '').toLowerCase()];
	return expand ? expand(match[2].trim()) : prompt;
}
