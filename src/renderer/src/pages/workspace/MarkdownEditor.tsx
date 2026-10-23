import { useEffect, useRef, useState } from 'react';
import { Extension, mergeAttributes, type JSONContent } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { workspaceFileType } from '@shared/workspace';
import { workspaceResourceUrl } from './Resource';
import { WorkspaceToolbar } from './Toolbar';

const assetKinds = new Set(['image', 'audio', 'video', 'pdf']);

interface WorkspaceMarkdownEditorProps {
	readonly path: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onSave: () => void;
	readonly onError: (message: string) => void;
}

export function WorkspaceMarkdownEditor({
	path,
	value,
	onChange,
	onSave,
	onError,
}: WorkspaceMarkdownEditorProps): React.JSX.Element {
	const [linkOpen, setLinkOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const onChangeRef = useRef(onChange);
	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);
	const editor = useEditor({
		extensions: [
			StarterKit.configure({ link: { openOnClick: false } }),
			TableKit.configure({ table: { resizable: false } }),
			TaskList,
			TaskItem.configure({ nested: true }),
			Image.extend({
				renderHTML({ HTMLAttributes }) {
					const src = typeof HTMLAttributes.src === 'string' ? workspaceResourceUrl(path, HTMLAttributes.src) : HTMLAttributes.src;
					return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src })];
				},
			}),
			Placeholder.configure({ placeholder: 'Start writing, or paste an image…' }),
			Markdown.configure({ markedOptions: { gfm: true } }),
			Extension.create({
				name: 'clearFormatting',
				addKeyboardShortcuts() {
					return { 'Mod-\\': () => this.editor.chain().focus().unsetAllMarks().clearNodes().run() };
				},
			}),
		],
		content: value,
		contentType: 'markdown',
		onUpdate: ({ editor: updatedEditor }) => onChangeRef.current(updatedEditor.getMarkdown()),
		editorProps: {
			attributes: {
				role: 'textbox',
				'aria-label': 'Markdown preview editor',
				'aria-multiline': 'true',
				class: 'workspace-markdown-preview min-h-[50vh] outline-none',
			},
		},
	});

	const insertFiles = (files: File[], position?: number): boolean => {
		const assets = files.filter((file) => assetKinds.has(workspaceFileType(file.name).kind));
		if (assets.length === 0) return false;
		void Promise.all(assets.map(async (file) => ({
			file,
			src: await window.agent.importWorkspaceAsset(path, file.name, new Uint8Array(await file.arrayBuffer())),
		}))).then((items) => {
			editor.chain().focus().insertContentAt(position ?? editor.state.selection, items.flatMap<JSONContent>(({ file, src }) => workspaceFileType(src).kind === 'image'
				? [{ type: 'image', attrs: { src, alt: file.name.replace(/\.[^.]+$/, '') } }]
				: [{ type: 'paragraph', content: [{ type: 'text', text: file.name, marks: [{ type: 'link', attrs: { href: src } }] }] }])).run();
		}).catch((cause: unknown) => onError(cause instanceof Error ? cause.message : 'Unable to add file.'));
		return true;
	};

	return (
		<div
			className="contents"
			onKeyDown={(event) => {
				if (!event.metaKey && !event.ctrlKey) return;
				const key = event.key.toLowerCase();
				if (key === 's') onSave();
				else if (key === 'k' && !event.shiftKey) setLinkOpen(true);
				else if (key === 'i' && event.shiftKey) fileInputRef.current?.click();
				else return;
				event.preventDefault();
			}}
			onPasteCapture={(event) => {
				if (!insertFiles(Array.from(event.clipboardData.files))) return;
				event.preventDefault();
				event.stopPropagation();
			}}
			onDropCapture={(event) => {
				if (!insertFiles(Array.from(event.dataTransfer.files), editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos)) return;
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<WorkspaceToolbar editor={editor} linkOpen={linkOpen} onLinkOpenChange={setLinkOpen} onInsertAsset={() => fileInputRef.current?.click()} />
			<input ref={fileInputRef} type="file" multiple hidden accept="image/*,audio/*,video/*,application/pdf" onChange={(event) => {
				insertFiles(Array.from(event.target.files ?? []));
				event.target.value = '';
			}} />
			<EditorContent
				editor={editor}
				className="min-h-full w-full break-words"
				onClick={(event) => {
					if (event.target === event.currentTarget) editor.commands.focus('end');
				}}
			/>
		</div>
	);
}
