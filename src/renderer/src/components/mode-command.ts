import { InputRule, Node } from '@tiptap/core';
import type { AgentModeInfo } from '@shared/agent_types';

export type ModeCommandStorage = {
	modes: readonly AgentModeInfo[];
};

declare module '@tiptap/core' {
	interface Storage {
		modeCommand: ModeCommandStorage;
	}
	interface Commands<ReturnType> {
		modeCommand: {
			setModes: (modes: readonly AgentModeInfo[]) => ReturnType;
		};
	}
}

export const ModeCommand = Node.create<object, ModeCommandStorage>({
	name: 'modeCommand',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: false,
	addStorage: () => ({ modes: [] }),
	addAttributes: () => ({
		id: { default: '', parseHTML: (element) => element.getAttribute('data-mode-command') ?? '' },
		title: { default: '', parseHTML: (element) => element.textContent ?? '' },
	}),
	parseHTML: () => [{ tag: 'span[data-mode-command]' }],
	renderHTML: ({ node }) => [
		'span',
		{
			'data-mode-command': node.attrs.id,
			class: 'font-semibold text-primary',
			contenteditable: 'false',
		},
		node.attrs.title,
	],
	renderText: () => '',
	renderMarkdown: () => '',
	addInputRules() {
		const type = this.type;
		const storage = this.storage;
		return [
			new InputRule({
				find: /\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
				handler: ({ state, range, match }) => {
					const mode = storage.modes.find((candidate) => candidate.command === match[0]);
					if (!mode || state.doc.textBetween(1, range.from).trim()) return null;
					let present = false;
					state.doc.descendants((node) => {
						if (node.type === type && node.attrs.id === mode.id) present = true;
						return !present;
					});
					if (present) return null;
					state.tr.replaceWith(range.from, range.to, [
						type.create({ id: mode.id, title: mode.title }),
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
				let position: number | undefined;
				doc.descendants((node, nodePosition) => {
					if (nodePosition >= selection.from) return false;
					if (node.type === this.type) position = nodePosition;
					return true;
				});
				if (position === undefined) return false;
				if (doc.textBetween(position + 1, selection.from).trim().length > 0) return false;
				const deleteFrom = position;
				return this.editor.commands.command(({ tr }) => {
					tr.delete(deleteFrom, selection.from);
					return true;
				});
			},
		};
	},
});
