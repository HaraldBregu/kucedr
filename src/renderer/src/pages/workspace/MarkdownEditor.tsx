import { useEffect, useRef } from 'react';
import { Image } from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface WorkspaceMarkdownEditorProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onSave: () => void;
}

export function WorkspaceMarkdownEditor({
	value,
	onChange,
	onSave,
}: WorkspaceMarkdownEditorProps): React.JSX.Element {
	const onChangeRef = useRef(onChange);
	const onSaveRef = useRef(onSave);
	useEffect(() => {
		onChangeRef.current = onChange;
		onSaveRef.current = onSave;
	}, [onChange, onSave]);
	const editor = useEditor({
		extensions: [
			StarterKit.configure({ link: { openOnClick: false } }),
			TableKit,
			TaskList,
			TaskItem,
			Image,
			Markdown.configure({ markedOptions: { gfm: true } }),
		],
		content: value,
		contentType: 'markdown',
		onUpdate: ({ editor: updatedEditor }) => onChangeRef.current(updatedEditor.getMarkdown()),
		editorProps: {
			attributes: {
				role: 'textbox',
				'aria-label': 'Markdown preview editor',
				'aria-multiline': 'true',
				class: 'workspace-markdown-preview min-h-full outline-none',
			},
			handleKeyDown: (_view, event) => {
				if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey)) return false;
				event.preventDefault();
				onSaveRef.current();
				return true;
			},
		},
	});

	useEffect(() => {
		if (editor && editor.getMarkdown() !== value) {
			editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
		}
	}, [editor, value]);

	return (
		<EditorContent
			editor={editor}
			className="mx-auto min-h-full w-full max-w-3xl break-words text-sm leading-7"
		/>
	);
}
