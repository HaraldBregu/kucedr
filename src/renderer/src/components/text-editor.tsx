import { useEffect, useRef, type ReactElement } from 'react';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { AgentModeInfo } from '@shared/agent_types';
import { cn } from '@/lib/utils';
import { ModeCommand } from './mode-command';

export type TextEditorProps = {
	readonly value?: string;
	readonly onValueChange?: (value: string) => void;
	readonly onSubmit?: () => void;
	readonly placeholder?: string;
	readonly disabled?: boolean;
	readonly className?: string;
	readonly ariaLabel?: string;
	readonly onEditorReady?: (editor: Editor) => void;
	readonly onVisualLineChange?: (hasMultipleLines: boolean) => void;
	readonly modes?: readonly AgentModeInfo[];
	readonly modeIds?: readonly string[];
	readonly onModeIdsChange?: (modeIds: string[]) => void;
};

const NO_MODES: readonly AgentModeInfo[] = [];
const NO_MODE_IDS: readonly string[] = [];

function TextEditor({
	value,
	onValueChange,
	onSubmit,
	placeholder,
	disabled = false,
	className,
	ariaLabel,
	onEditorReady,
	onVisualLineChange,
	modes = NO_MODES,
	modeIds = NO_MODE_IDS,
	onModeIdsChange,
}: TextEditorProps): ReactElement {
	const onValueChangeRef = useRef(onValueChange);
	const onSubmitRef = useRef(onSubmit);
	const onVisualLineChangeRef = useRef(onVisualLineChange);
	const onModeIdsChangeRef = useRef(onModeIdsChange);
	const modesRef = useRef(modes);
	const modeIdsRef = useRef(modeIds);
	const lastEditorValueRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		onValueChangeRef.current = onValueChange;
		onSubmitRef.current = onSubmit;
		onVisualLineChangeRef.current = onVisualLineChange;
		onModeIdsChangeRef.current = onModeIdsChange;
		modesRef.current = modes;
		modeIdsRef.current = modeIds;
	}, [modeIds, modes, onModeIdsChange, onSubmit, onValueChange, onVisualLineChange]);

	const chipIds = (target: Editor): string[] => {
		const ids: string[] = [];
		target.state.doc.descendants((node) => {
			if (node.type.name === ModeCommand.name) ids.push(node.attrs.id as string);
		});
		return ids;
	};

	const chips = (ids: readonly string[]) =>
		ids.flatMap((id) => [
			{
				type: ModeCommand.name,
				attrs: {
					id,
					command: modesRef.current.find((mode) => mode.id === id)?.command ?? `/${id}`,
				},
			},
			{ type: 'text', text: ' ' },
		]);

	const reportModeIds = (updatedEditor: Editor): void => {
		const ids = chipIds(updatedEditor);
		if (ids.join('\n') !== modeIdsRef.current.join('\n')) onModeIdsChangeRef.current?.(ids);
	};

	const reportVisualLineChange = (updatedEditor: Editor): void => {
		if (!onVisualLineChangeRef.current) return;
		const range = updatedEditor.view.dom.ownerDocument.createRange();
		range.selectNodeContents(updatedEditor.view.dom);
		const lineTops = new Set(
			Array.from(range.getClientRects())
				.filter((rect) => rect.width > 0 && rect.height > 0)
				.map((rect) => Math.round(rect.top))
		);
		onVisualLineChangeRef.current?.(lineTops.size > 1);
	};

	const editor = useEditor({
		extensions: [
			StarterKit,
			Placeholder.configure({ placeholder }),
			ModeCommand,
			Markdown,
		],
		content: value ?? '',
		contentType: 'markdown',
		editable: !disabled,
		onCreate: ({ editor: createdEditor }) => {
			onEditorReady?.(createdEditor);
			reportVisualLineChange(createdEditor);
		},
		onUpdate: ({ editor: updatedEditor }) => {
			const markdown = updatedEditor.getMarkdown();
			lastEditorValueRef.current = markdown;
			onValueChangeRef.current?.(markdown);
			reportModeIds(updatedEditor);
			reportVisualLineChange(updatedEditor);
		},
		editorProps: {
			attributes: {
				role: 'textbox',
				'aria-multiline': 'true',
				...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
				class: 'outline-none',
			},
			handleDrop: (view, event) => {
				const files = Array.from(event.dataTransfer?.files ?? []);
				if (files.length === 0) return false;
				const paths = files
					.map((file) => window.app.getPathForFile(file))
					.filter((path) => path.length > 0);
				if (paths.length > 0) {
					const pos =
						view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
						view.state.selection.to;
					view.dispatch(view.state.tr.insertText(paths.join(' '), pos));
				}
				return true;
			},
			handleKeyDown: (view, event) => {
				if (
					event.key !== 'Enter' ||
					event.shiftKey ||
					event.altKey ||
					event.metaKey ||
					event.ctrlKey
				)
					return false;
				// Inside lists and code blocks Enter keeps its editing role
				// (next item / newline); an empty trailing item exits the block first.
				const { $from } = view.state.selection;
				for (let depth = $from.depth; depth > 0; depth--) {
					const nodeName = $from.node(depth).type.name;
					if (nodeName === 'listItem' || nodeName === 'codeBlock') return false;
				}
				onSubmitRef.current?.();
				return true;
			},
		},
	});

	useEffect(() => {
		if (
			!editor ||
			(value ?? '') === lastEditorValueRef.current ||
			editor.getMarkdown() === (value ?? '')
		)
			return;
		const chain = editor.chain().setContent(value ?? '', {
			emitUpdate: false,
			contentType: 'markdown',
		});
		if (modeIdsRef.current.length > 0) chain.insertContentAt(1, chips(modeIdsRef.current));
		if (editor.isFocused) chain.focus('end');
		chain.run();
		lastEditorValueRef.current = value ?? '';
		reportVisualLineChange(editor);
	}, [editor, value]);

	useEffect(() => {
		if (!editor || chipIds(editor).join('\n') === modeIds.join('\n')) return;
		const chain = editor.chain().command(({ tr }) => {
			const positions: number[] = [];
			tr.doc.descendants((node, position) => {
				if (node.type.name === ModeCommand.name) positions.push(position);
			});
			for (const position of positions.reverse()) {
				const end = tr.doc.textBetween(position + 1, position + 2) === ' ' ? 2 : 1;
				tr.delete(position, position + end);
			}
			return true;
		});
		if (modeIds.length > 0) chain.insertContentAt(1, chips(modeIds));
		chain.run();
	}, [editor, modeIds]);

	useEffect(() => {
		editor?.commands.setModes(modes);
	}, [editor, modes]);

	useEffect(() => {
		editor?.setEditable(!disabled);
	}, [editor, disabled]);

	return <EditorContent editor={editor} className={cn('w-full', className)} />;
}

export { TextEditor };
