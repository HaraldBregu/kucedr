import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Extension, mergeAttributes, type JSONContent } from '@tiptap/core';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Image } from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { importWorkspaceAssets } from './Assets';
import { WorkspaceCodeBlock } from './CodeBlock';
import type { CodeMirrorEditorHandle } from './Editor';
import { searchKey, WorkspaceSearch } from './Search';
import { workspaceResourceUrl } from './Resource';
import { WorkspaceLibraryPicker } from './LibraryPicker';
import { WorkspaceOutline } from './Outline';
import { WorkspaceToolbar } from './Toolbar';
import { WorkspaceScriptForm } from './ScriptForm';
import { WorkspaceUrlDialog } from './UrlDialog';
import type { PluginScriptInfo } from '../../../../shared/plugin_types';

interface WorkspaceMarkdownEditorProps {
	readonly path: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onSave: () => void;
	readonly onError: (message: string) => void;
	readonly onOpenLink: (href: string) => void;
	readonly onFind: () => void;
	readonly onMatchCount: (count: number) => void;
	readonly wide: boolean;
	readonly onWideChange: (wide: boolean) => void;
	readonly ref?: React.Ref<Pick<CodeMirrorEditorHandle, 'find' | 'replace' | 'clearSearch'>>;
}

export function WorkspaceMarkdownEditor({
	path,
	value,
	onChange,
	onSave,
	onError,
	onOpenLink,
	wide,
	onWideChange,
	onFind,
	onMatchCount,
	ref,
}: WorkspaceMarkdownEditorProps): React.JSX.Element {
	const [linkOpen, setLinkOpen] = useState(false);
	const [libraryOpen, setLibraryOpen] = useState(false);
	const [urlOpen, setUrlOpen] = useState(false);
	const [script, setScript] = useState<PluginScriptInfo | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const onChangeRef = useRef(onChange);
	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);
	const editor = useEditor({
		extensions: [
			StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
			CodeBlock.extend({ addNodeView: () => ReactNodeViewRenderer(WorkspaceCodeBlock) }),
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
			WorkspaceSearch.configure({ onMatchCount }),
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
		const imported = importWorkspaceAssets(path, files);
		if (!imported) return false;
		void imported.then((items) => {
			editor.chain().focus().insertContentAt(position ?? editor.state.selection, items.flatMap<JSONContent>(({ file, src, image }) => image
				? [{ type: 'image', attrs: { src, alt: file.name.replace(/\.[^.]+$/, '') } }]
				: [{ type: 'paragraph', content: [{ type: 'text', text: file.name, marks: [{ type: 'link', attrs: { href: src } }] }] }])).command(({ tr }) => {
				if (!(tr.selection instanceof NodeSelection)) return true;
				const after = tr.selection.to;
				if (!tr.doc.resolve(after).nodeAfter) tr.insert(after, tr.doc.type.schema.nodes.paragraph.create());
				tr.setSelection(Selection.near(tr.doc.resolve(after + 1)));
				return true;
			}).run();
		}).catch((cause: unknown) => onError(cause instanceof Error ? cause.message : 'Unable to add file.'));
		return true;
	};

	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
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
			<WorkspaceToolbar editor={editor} linkOpen={linkOpen} onLinkOpenChange={setLinkOpen} onInsertFromComputer={() => fileInputRef.current?.click()} onInsertFromLibrary={() => setLibraryOpen(true)} onInsertFromUrl={() => setUrlOpen(true)} onInsertScript={setScript} wide={wide} onWideChange={onWideChange} onFind={onFind} />
			{script?.fence ? <WorkspaceScriptForm script={script} value={(script.inputSchema?.examples?.[0] ?? {}) as Record<string, unknown>} submitLabel="Insert" onClose={() => setScript(null)} onSubmit={(input) => {
				setScript(null);
				editor.chain().focus().insertContent({
					type: 'codeBlock',
					attrs: { language: script.fence },
					content: [{ type: 'text', text: JSON.stringify(input, null, 2) }],
				}).run();
			}} /> : null}
			{urlOpen ? <WorkspaceUrlDialog onClose={() => setUrlOpen(false)} onInsert={(src, alt) => {
				setUrlOpen(false);
				editor.chain().focus().setImage({ src, alt }).run();
			}} /> : null}
			{libraryOpen ? <WorkspaceLibraryPicker onClose={() => setLibraryOpen(false)} onPick={(file) => {
				setLibraryOpen(false);
				void window.agent.readPromptFile(file.path)
					.then((data) => insertFiles([new File([new Uint8Array(data)], file.name)]))
					.catch((cause: unknown) => onError(cause instanceof Error ? cause.message : 'Unable to add file.'));
			}} /> : null}
			<input ref={fileInputRef} type="file" multiple hidden accept="image/*,audio/*,video/*,application/pdf" onChange={(event) => {
				insertFiles(Array.from(event.target.files ?? []));
				event.target.value = '';
			}} />
			<div className="relative flex min-h-0 flex-1 flex-col">
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
			<EditorContent
				editor={editor}
				className={`workspace-markdown-content mx-auto min-h-full w-full ${wide ? '' : 'max-w-[920px]'} break-words px-5 pb-16 pt-8 text-[15px] leading-7 sm:px-8 lg:px-12`}
				onClick={(event) => {
					const href = (event.target as HTMLElement).closest('a')?.getAttribute('href');
					if (href && (event.metaKey || event.ctrlKey)) {
						event.preventDefault();
						onOpenLink(href);
					} else if (event.target === event.currentTarget) editor.commands.focus('end');
				}}
			/>
			</div>
			<WorkspaceOutline editor={editor} container={scrollRef} />
			</div>
		</div>
	);
}
