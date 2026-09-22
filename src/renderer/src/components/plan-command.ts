import { InputRule, Node } from '@tiptap/core';

export const PlanCommand = Node.create({
	name: 'planCommand',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: false,
	parseHTML: () => [{ tag: 'span[data-plan-command]' }],
	renderHTML: () => [
		'span',
		{
			'data-plan-command': '',
			class: 'font-semibold text-purple-600 dark:text-purple-400',
			contenteditable: 'false',
		},
		'Plan',
	],
	renderText: () => '',
	renderMarkdown: () => '',
	addInputRules() {
		const type = this.type;
		return [
			new InputRule({
				find: /^\/plan$/,
				handler: ({ state, range }) => {
					if (range.from !== 1) return null;
					state.tr.replaceWith(range.from, range.to, [
						type.create(),
						state.schema.text(' '),
					]);
					return undefined;
				},
			}),
		];
	},
	addKeyboardShortcuts() {
		return {
			Backspace: () => {
				const { doc, selection } = this.editor.state;
				if (!selection.empty) return false;
				let planPosition: number | undefined;
				doc.descendants((node, position) => {
					if (node.type === this.type) planPosition = position;
					return planPosition === undefined;
				});
				if (planPosition === undefined || selection.from <= planPosition) return false;
				if (doc.textBetween(planPosition + 1, selection.from).trim().length > 0) return false;
				const deleteFrom = planPosition;
				return this.editor.commands.command(({ tr }) => {
					tr.delete(deleteFrom, selection.from);
					return true;
				});
			},
		};
	},
});
