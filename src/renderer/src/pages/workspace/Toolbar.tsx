import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { PromptEditor } from '@/components/prompt-editor';
import { PromptSubmit } from '@/components/prompt-submit';
import { PromptInputActions } from '@/components/ui/prompt-input';
import { Model } from '../home/Model';
import { modelChoice } from './Choice';
import { MediaModel } from './MediaModel';
import { Option } from './Option';
import { libraryFileUrl } from '@/pages/settings/pages/library/url';
import { readEffort } from '../home/effort/read';
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react-dom';
import type { ChainedCommands, Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
	AudioLines,
	Bold,
	Code,
	Check,
	ChevronDown,
	Columns3,
	Eraser,
	FileBox,
	FileCode,
	Heading1,
	Heading2,
	Heading3,
	HardDrive,
	MoveHorizontal,
	Search,
	Sparkles,
	SpellCheck,
	Shrink,
	Expand,
	Globe,
	Library,
	ImageIcon,
	Italic,
	Link,
	List,
	ListChecks,
	ListOrdered,
	Loader2,
	Minus,
	Quote,
	Redo2,
	Rows3,
	Strikethrough,
	Table,
	Trash2,
	Type,
	Underline,
	Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePluginScripts } from '@/hooks/use-plugin-scripts';
import type { PluginScriptInfo } from '../../../../shared/plugin_types';

const inlineAiKey = new PluginKey('workspaceInlineAi');

const mod = navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl+';
const alt = navigator.platform.startsWith('Mac') ? '⌥' : 'Alt+';

interface Action {
	readonly label: string;
	readonly icon: typeof Bold;
	readonly shortcut?: string;
	readonly active?: string | [string, Record<string, unknown>];
	readonly run: (chain: ChainedCommands) => ChainedCommands;
}

const groups: Action[][] = [
	[
		{ label: 'Undo', icon: Undo2, shortcut: `${mod}Z`, run: (chain) => chain.undo() },
		{ label: 'Redo', icon: Redo2, shortcut: `${mod}⇧Z`, run: (chain) => chain.redo() },
	],
	[
		{ label: 'Heading 1', icon: Heading1, shortcut: `${mod}${alt}1`, active: ['heading', { level: 1 }], run: (chain) => chain.toggleHeading({ level: 1 }) },
		{ label: 'Heading 2', icon: Heading2, shortcut: `${mod}${alt}2`, active: ['heading', { level: 2 }], run: (chain) => chain.toggleHeading({ level: 2 }) },
		{ label: 'Heading 3', icon: Heading3, shortcut: `${mod}${alt}3`, active: ['heading', { level: 3 }], run: (chain) => chain.toggleHeading({ level: 3 }) },
	],
	[
		{ label: 'Bold', icon: Bold, shortcut: `${mod}B`, active: 'bold', run: (chain) => chain.toggleBold() },
		{ label: 'Italic', icon: Italic, shortcut: `${mod}I`, active: 'italic', run: (chain) => chain.toggleItalic() },
		{ label: 'Underline', icon: Underline, shortcut: `${mod}U`, active: 'underline', run: (chain) => chain.toggleUnderline() },
		{ label: 'Strikethrough', icon: Strikethrough, shortcut: `${mod}⇧S`, active: 'strike', run: (chain) => chain.toggleStrike() },
		{ label: 'Inline code', icon: Code, shortcut: `${mod}E`, active: 'code', run: (chain) => chain.toggleCode() },
		{ label: 'Clear formatting', icon: Eraser, shortcut: `${mod}\\`, run: (chain) => chain.unsetAllMarks().clearNodes() },
	],
	[
		{ label: 'Bulleted list', icon: List, shortcut: `${mod}⇧8`, active: 'bulletList', run: (chain) => chain.toggleBulletList() },
		{ label: 'Numbered list', icon: ListOrdered, shortcut: `${mod}⇧7`, active: 'orderedList', run: (chain) => chain.toggleOrderedList() },
		{ label: 'Task list', icon: ListChecks, shortcut: `${mod}⇧9`, active: 'taskList', run: (chain) => chain.toggleTaskList() },
		{ label: 'Quote', icon: Quote, shortcut: `${mod}⇧B`, active: 'blockquote', run: (chain) => chain.toggleBlockquote() },
		{ label: 'Code block', icon: FileCode, shortcut: `${mod}${alt}C`, active: 'codeBlock', run: (chain) => chain.toggleCodeBlock() },
		{ label: 'Divider', icon: Minus, run: (chain) => chain.setHorizontalRule() },
		{ label: 'Table', icon: Table, run: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },	],
];

const tableActions: Action[] = [
	{ label: 'Add row', icon: Rows3, run: (chain) => chain.addRowAfter() },
	{ label: 'Add column', icon: Columns3, run: (chain) => chain.addColumnAfter() },
	{ label: 'Delete row', icon: Rows3, run: (chain) => chain.deleteRow() },
	{ label: 'Delete column', icon: Columns3, run: (chain) => chain.deleteColumn() },
	{ label: 'Delete table', icon: Trash2, run: (chain) => chain.deleteTable() },
];

interface WorkspaceToolbarProps {
	readonly toolbarTarget: HTMLElement | null;
	readonly scrollbarWidth: number;
	readonly editor: Editor;
	readonly linkOpen: boolean;
	readonly onLinkOpenChange: (open: boolean) => void;
	readonly onInsertFromComputer: () => void;
	readonly onInsertFromLibrary: () => void;
	readonly onInsertFromUrl: () => void;
	readonly onInsertScript: (script: PluginScriptInfo) => void;
	readonly onFind: () => void;
	readonly wide: boolean;
	readonly onWideChange: (wide: boolean) => void;
}

export function WorkspaceToolbar({ toolbarTarget, scrollbarWidth, editor, linkOpen, onLinkOpenChange, onInsertFromComputer, onInsertFromLibrary, onInsertFromUrl, onInsertScript, wide, onWideChange, onFind }: WorkspaceToolbarProps): React.JSX.Element {
	const [ai, setAi] = useState<{ from: number; to: number; text: string; doc: string; prompt: string; result: string; error: string; loading: boolean; autoApply: boolean } | null>(null);
	const [aiTarget, setAiTarget] = useState<HTMLElement | null>(null);
	const [mode, setMode] = useState<'text' | 'image' | 'voice'>('text');
	const [mediaSelection, setMediaSelection] = useState({ providerId: '', modelId: '' });
	const requestId = useRef(0);
	const streamId = useRef<string | null>(null);
	useEffect(() => () => { requestId.current++; if (streamId.current) void window.models.text.cancelStream(streamId.current); }, []);
	const [href, setHref] = useState('');
	const [selection, setSelection] = useState(false);
	const [stylesOpen, setStylesOpen] = useState(false);
	const [slash, setSlash] = useState<{ from: number; to: number; query: string } | null>(null);
	const [selected, setSelected] = useState(0);
	const [dismissed, setDismissed] = useState<number | null>(null);
	const { byFence } = usePluginScripts();
	const { refs: { setReference, setFloating }, elements: { floating: floatingElement }, floatingStyles, update: updatePosition } = useFloating({ placement: slash ? 'bottom-start' : 'top', middleware: [offset(8), flip(), shift({ padding: 8 }), size({ padding: 8, apply({ availableHeight, elements }) { elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`; } })], whileElementsMounted: autoUpdate });
	const { refs: { setReference: setStyleReference, setFloating: setStyleFloating }, floatingStyles: stylePosition } = useFloating({ placement: 'bottom-start', middleware: [offset(8), flip(), shift({ padding: 8 })], whileElementsMounted: autoUpdate });
	const state = useEditorState({ editor, selector: ({ editor: current }) => ({
		active: groups.flat().map((action) => action.active ? typeof action.active === 'string' ? current.isActive(action.active) : current.isActive(...action.active) : false),
		table: current.isActive('table'), link: current.isActive('link'), canUndo: current.can().undo(), canRedo: current.can().redo(),
	}) });
	const scriptCommands = [...byFence].map(([, script]) => ({ label: script.title, icon: FileBox, run: () => onInsertScript(script) }));
	const allCommands = [
		...groups.flat().map((action) => ({ label: action.label, icon: action.icon, run: () => action.run(editor.chain().focus()).run() })),
		...(state.table ? tableActions.map((action) => ({ label: action.label, icon: action.icon, run: () => action.run(editor.chain().focus()).run() })) : []),
		{ label: 'Edit with AI', icon: Sparkles, run: () => openAi() },
		{ label: 'Link', icon: Link, run: () => onLinkOpenChange(true) },
		{ label: 'Insert from computer', icon: HardDrive, run: onInsertFromComputer },
		{ label: 'Insert from library', icon: Library, run: onInsertFromLibrary },
		{ label: 'Insert from URL', icon: Globe, run: onInsertFromUrl },
		...scriptCommands,
		{ label: 'Find in file', icon: Search, run: onFind },
		{ label: 'Full width', icon: MoveHorizontal, run: () => onWideChange(!wide) },
	];
	const commands = allCommands.filter((command) => !((command.label === 'Undo' && !state.canUndo) || (command.label === 'Redo' && !state.canRedo)) && command.label.toLowerCase().includes(slash?.query.toLowerCase() ?? ''));

	useEffect(() => {
		let selecting = false;
		let frame = 0;
		const update = (): void => {
			const { from, empty, $from } = editor.state.selection;
			const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
			const match = empty && editor.isFocused ? before.match(/\/([^/]*)$/) : null;
			const start = match ? from - match[0].length : null;
			setSlash(start !== null && start !== dismissed ? { from: start, to: from, query: match![1] } : null);
			setSelection(editor.state.selection instanceof TextSelection && !empty && editor.isFocused && !selecting);
			if (start === null || start !== dismissed) setDismissed(null);
		};
		const startPointerSelection = (event: PointerEvent): void => {
			if (!editor.isInitialized || !(event.target instanceof Node) || !editor.view.dom.contains(event.target)) return;
			cancelAnimationFrame(frame);
			selecting = true;
			setSelection(false);
		};
		const finishPointerSelection = (): void => {
			if (!selecting) return;
			selecting = false;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(update);
		};
		document.addEventListener('pointerdown', startPointerSelection);
		document.addEventListener('pointerup', finishPointerSelection);
		document.addEventListener('pointercancel', finishPointerSelection);
		editor.on('transaction', update);
		editor.on('focus', update);
		editor.on('blur', update);
		update();
		return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', startPointerSelection); document.removeEventListener('pointerup', finishPointerSelection); document.removeEventListener('pointercancel', finishPointerSelection); editor.off('transaction', update); editor.off('focus', update); editor.off('blur', update); };
	}, [editor, dismissed]);

	useEffect(() => {
		const updateSelection = (): void => {
			if (!editor.isFocused) return;
			const { from, to } = editor.state.selection;
			const text = editor.state.doc.textBetween(from, to, '\n');
			const doc = JSON.stringify(editor.state.doc.toJSON());
			setAi((current) => current && !current.loading && !current.autoApply ? { ...current, from, to, text, doc, error: '' } : current);
		};
		editor.on('selectionUpdate', updateSelection);
		return () => { editor.off('selectionUpdate', updateSelection); };
	}, [editor]);

	useEffect(() => { if (!selection) setStylesOpen(false); }, [selection]);
	useEffect(() => { setSelected(0); }, [slash?.query]);
	useEffect(() => { floatingElement?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [selected, floatingElement]);
	useEffect(() => {
		if (!slash && !selection && !linkOpen) return;
		setReference({
			contextElement: editor.view.dom,
			getBoundingClientRect: () => {
				if (!slash) {
					const range = editor.view.dom.ownerDocument.getSelection();
					if (range && range.rangeCount && !range.isCollapsed) return range.getRangeAt(0).getBoundingClientRect();
				}
				const pos = editor.view.coordsAtPos(Math.min(slash?.to ?? editor.state.selection.from, editor.state.doc.content.size));
				return new DOMRect(pos.left, pos.top, pos.right - pos.left, pos.bottom - pos.top);
			},
		});
		void updatePosition();
	}, [editor, slash, selection, linkOpen, setReference, updatePosition]);
	useEffect(() => { if (linkOpen) setHref(editor.getAttributes('link').href ?? ''); }, [editor, linkOpen]);
	useEffect(() => {
		if (!linkOpen) return;
		const dismiss = (event: PointerEvent): void => {
			if (event.target instanceof Node && !floatingElement?.contains(event.target) && !editor.view.dom.contains(event.target)) onLinkOpenChange(false);
		};
		document.addEventListener('pointerdown', dismiss);
		return () => document.removeEventListener('pointerdown', dismiss);
	}, [editor, floatingElement, linkOpen, onLinkOpenChange]);

	const openAi = (instruction = ''): void => {
		setMode('text');
		const { from, to } = editor.state.selection;
		const text = editor.state.doc.textBetween(from, to, '\n');
		const value = { from, to, text, doc: JSON.stringify(editor.state.doc.toJSON()), prompt: instruction, result: '', error: '', loading: false, autoApply: Boolean(instruction) };
		setAi(value);
		if (!instruction) {
			const target = document.createElement('div');
			target.contentEditable = 'false';
			target.className = 'my-4 w-full';
			target.dataset.position = String(editor.state.selection.$to.depth ? editor.state.selection.$to.after(1) : to);
			setAiTarget(target);
		}
		if (instruction) generate(value);
	};
	const generate = (value: NonNullable<typeof ai>): void => {
		if (!value.prompt.trim()) return;
		const id = ++requestId.current;
		setAi({ ...value, loading: true, error: '', result: '' });
		if (mode === 'voice' && !value.autoApply) {
			void Promise.all([window.app.getWorkspaceVoiceModel(), window.app.getWorkspaceModelOptions()]).then(async ([{ providerId, modelId }, options]) => {
				if (!providerId || !modelId) throw new Error('Select a workspace voice model first.');
				if (requestId.current !== id) return;
				const voice = modelChoice('text-to-speech', VOICE_INPUTS, providerId, modelId, options)?.value;
				const result = await window.models.voice.synthesize({ text: value.prompt, providerId, modelId, voice });
				if (requestId.current !== id) return;
				if (JSON.stringify(editor.state.doc.toJSON()) !== value.doc) throw new Error('The document changed. Please start again.');
				const extension = result.mimeType === 'audio/mpeg' ? 'mp3' : result.mimeType.split('/')[1];
				const src = await window.agent.importWorkspaceAsset(path, `voice.${extension}`, Uint8Array.from(atob(result.audio), (character) => character.charCodeAt(0)));
				if (requestId.current !== id) return;
				editor.chain().focus().insertContentAt(value.to, { type: 'image', attrs: { src, alt: 'Generated voice' } }).run();
				setAi(null);
			}).catch((error: unknown) => {
				if (requestId.current === id) setAi((current) => current ? { ...current, loading: false, error: error instanceof Error ? error.message : 'Unable to generate voice.' } : null);
			});
			return;
		}
		if (mode === 'image' && !value.autoApply) {
			void Promise.all([window.app.getWorkspaceImageModel(), window.app.getWorkspaceModelOptions()]).then(async ([{ providerId, modelId }, options]) => {
				if (!providerId || !modelId) throw new Error('Select a workspace image model first.');
				if (requestId.current !== id) return;
				const prompt = value.text ? `${value.prompt}\n\nSelected text:\n${value.text}` : value.prompt;
				const ratio = modelChoice('text-to-image', RATIO_INPUTS, providerId, modelId, options);
				const result = await window.models.image.createImage({ prompt, providerId, modelId, options: ratio ? { [ratio.name]: ratio.value } : undefined });
				if (requestId.current !== id) return;
				if (JSON.stringify(editor.state.doc.toJSON()) !== value.doc) throw new Error('The document changed. Please start again.');
				if (!result.path) throw new Error('Unable to save the generated image.');
				editor.chain().focus().insertContentAt(value.to, { type: 'image', attrs: { src: libraryFileUrl(result.path), alt: value.prompt.trim() } }).run();
				setAi(null);
			}).catch((error: unknown) => {
				if (requestId.current === id) setAi((current) => current ? { ...current, loading: false, error: error instanceof Error ? error.message : 'Unable to generate image.' } : null);
			});
			return;
		}
		const prompt = `Return only the resulting text in the original language, preserving relevant Markdown formatting. ${value.text ? `Edit the following text: ${value.prompt}\n\nText:\n${value.text}` : `Complete the document at the cursor following this instruction: ${value.prompt}\n\nReturn only the new text to insert, without repeating the existing text.\n\nBefore the cursor:\n${editor.state.doc.textBetween(0, value.from, '\n')}\n\nAfter the cursor:\n${editor.state.doc.textBetween(value.to, editor.state.doc.content.size, '\n')}`}`;
		const stream = crypto.randomUUID();
		streamId.current = stream;
		let output = '';
		let end = value.to;
		let expectedDoc = value.doc;
		void window.app.getWorkspaceModel().then(({ providerId, modelId }) => {
			if (!providerId || !modelId) throw new Error('Select a workspace model first.');
			if (requestId.current !== id) return;
			return window.models.text.streamText(stream, { prompt, providerId, modelId, effort: readEffort(providerId, modelId) }, (delta) => {
				if (requestId.current !== id) return;
				if (JSON.stringify(editor.state.doc.toJSON()) !== expectedDoc) {
					requestId.current++;
					void window.models.text.cancelStream(stream);
					setAi((current) => current ? { ...current, loading: false, error: 'The document changed. Please start again.' } : null);
					return;
				}
				if (!delta) return;
				const from = output ? end : value.from;
				const transaction = editor.state.tr.insertText(delta, from, end);
				end = transaction.mapping.map(end, 1);
				editor.view.dispatch(transaction);
				output += delta;
				expectedDoc = JSON.stringify(editor.state.doc.toJSON());
			});
		}).then(() => {
			if (requestId.current !== id) return;
			if (output.trim()) {
				if (JSON.stringify(editor.state.doc.toJSON()) !== expectedDoc) {
					setAi((current) => current ? { ...current, loading: false, error: 'The document changed. Please start again.' } : null);
					return;
				}
				editor.commands.insertContentAt({ from: value.from, to: end }, output, { contentType: 'markdown' });
				setAi(null);
			} else setAi((current) => current ? { ...current, loading: false, error: 'No text was generated. Please try again.' } : null);
		}).catch((error: unknown) => {
			if (requestId.current === id) setAi((current) => current ? { ...current, loading: false, error: error instanceof Error ? error.message : 'Unable to generate text.' } : null);
		}).finally(() => { if (streamId.current === stream) streamId.current = null; });
	};
	const submitAi = (): void => {
		if (!ai) return;
		if (!ai.loading) { generate(ai); return; }
		requestId.current++;
		if (streamId.current) void window.models.text.cancelStream(streamId.current);
		setAi(null);
	};
	const inlineActive = Boolean(ai && !ai.autoApply);
	useEffect(() => {
		if (!aiTarget || !inlineActive) return;
		const position = Number(aiTarget.dataset.position);
		editor.registerPlugin(new Plugin({ key: inlineAiKey, state: { init: (_, state) => DecorationSet.create(state.doc, [Decoration.widget(Math.min(position, state.doc.content.size), aiTarget, { side: 1, stopEvent: () => true, ignoreSelection: true })]), apply: (transaction, decorations) => decorations.map(transaction.mapping, transaction.doc) }, props: { decorations(state) { return inlineAiKey.getState(state); } } }));
		const timer = setTimeout(() => aiTarget.querySelector<HTMLElement>('[contenteditable="true"]')?.focus(), 0);
		return () => { clearTimeout(timer); editor.unregisterPlugin(inlineAiKey); };
	}, [editor, aiTarget, inlineActive]);

	const execute = (index: number): void => {
		const command = commands[index];
		if (!command || !slash) return;
		editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
		setSlash(null);
		command.run();
	};
	useEffect(() => {
		if (!slash || !commands.length) return;
		const keydown = (event: KeyboardEvent): void => {
			if (!slash) return;
			if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissed(slash.from); setSlash(null); }
			else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); setSelected((index) => commands.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length : 0); }
			else if (event.key === 'Enter' && commands[selected]) { event.preventDefault(); event.stopPropagation(); execute(selected); }
		};
		const dom = editor.view.dom;
		dom.addEventListener('keydown', keydown, true);
		return () => dom.removeEventListener('keydown', keydown, true);
	});

	const toolbar = toolbarTarget ? createPortal(<div style={{ paddingRight: scrollbarWidth }}><div className={`mx-auto flex w-full ${wide ? '' : 'max-w-[920px]'} flex-wrap items-center justify-start px-5 py-2 sm:px-8 lg:px-12`}>
		<div className="flex w-full flex-wrap items-center gap-2 rounded-lg border p-1">
		{[
			{ title: 'History', labels: ['Undo', 'Redo'] },
			{ title: 'Text', labels: groups[2].map((action) => action.label) },
			{ title: 'Blocks', labels: groups[3].map((action) => action.label) },
			{ title: 'Insert & tools', labels: allCommands.filter((command) => !scriptCommands.includes(command) && !groups.flat().some((action) => action.label === command.label) && !['Full width', 'Edit with AI'].includes(command.label)).map((command) => command.label) },
		].map(({ title, labels }) => <section key={title} className="max-w-full shrink-0"><div role="toolbar" aria-label={title === 'Text' ? 'Editor actions' : title} className="flex flex-wrap items-center justify-start gap-0.5">{title === 'Text' ? <Select value={groups[1].find((action) => action.active && typeof action.active !== 'string' && editor.isActive(...action.active))?.label ?? 'Text'} onValueChange={(value) => {
			if (value === 'Text') editor.chain().focus().setParagraph().run();
			else groups[1].find((action) => action.label === value)?.run(editor.chain().focus()).run();
		}}><SelectTrigger size="sm" aria-label="Heading"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Text">Text</SelectItem>{groups[1].map((action) => <SelectItem key={action.label} value={action.label}>{action.label}</SelectItem>)}</SelectContent></Select> : null}{allCommands.filter((command) => !scriptCommands.includes(command) && labels.includes(command.label)).map((command) => {
			const action = groups.flat().find((item) => item.label === command.label);
			const active = action?.active ? typeof action.active === 'string' ? editor.isActive(action.active) : editor.isActive(...action.active) : false;
			return <Tooltip key={command.label}><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={command.label} disabled={(command.label === 'Undo' && !state.canUndo) || (command.label === 'Redo' && !state.canRedo)} aria-pressed={action?.active ? active : undefined} className={active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'} onMouseDown={(event) => event.preventDefault()} onClick={command.run}><command.icon /></Button>} /><TooltipContent>{command.label}</TooltipContent></Tooltip>;
		})}{title === 'Insert & tools' && scriptCommands.length > 0 ? <DropdownMenu>
			<DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="Insert script" className="text-muted-foreground hover:text-foreground" onMouseDown={(event) => event.preventDefault()}><FileBox /></Button></DropdownMenuTrigger>
			<DropdownMenuContent align="start">{[...byFence].map(([fence, script]) => <DropdownMenuItem key={fence} onSelect={() => onInsertScript(script)}>{script.title}</DropdownMenuItem>)}</DropdownMenuContent>
		</DropdownMenu> : null}</div></section>)}
		<section className="shrink-0"><div role="toolbar" aria-label="AI writing" className="flex items-center">
			<DropdownMenu>
				<DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="AI writing" disabled={ai?.loading} onMouseDown={(event) => event.preventDefault()}><Sparkles /></Button></DropdownMenuTrigger>
				<DropdownMenuContent align="start">{[{ label: 'Edit with AI', icon: Sparkles }, { label: 'Improve writing', icon: Sparkles }, { label: 'Fix spelling and grammar', icon: SpellCheck }, { label: 'Make shorter', icon: Shrink }, { label: 'Make longer', icon: Expand }].map(({ label, icon: Icon }) => <DropdownMenuItem key={label} disabled={label !== 'Edit with AI' && editor.state.selection.empty} onSelect={() => openAi(label === 'Edit with AI' ? '' : label)}><Icon />{label}</DropdownMenuItem>)}</DropdownMenuContent>
			</DropdownMenu>
		</div></section>
		</div>
	</div></div>, toolbarTarget) : null;
	const inlineAi = ai && !ai.autoApply && aiTarget ? createPortal(<div className="space-y-2" data-slot="inline-ai-composer">
				{ai.text ? <span role="status" className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Selected {ai.from}–{ai.to}</span> : null}
				<PromptEditor detachedControls expanded={false} ariaLabel="AI instruction" placeholder={mode === 'image' ? "Describe an image" : mode === 'voice' ? "Text to speak" : "Ask anything"} value={ai.prompt} onValueChange={(prompt) => setAi({ ...ai, prompt })} onSubmit={submitAi} isLoading={ai.loading} maxHeight={360} wrapperClassName="max-w-none" className="w-full" leadingAction={<div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-2 text-sm text-foreground shadow-none hover:text-foreground" aria-label="Generation type" disabled={ai.loading}>{mode === 'image' ? <ImageIcon /> : mode === 'voice' ? <AudioLines /> : <Type />}{mode === 'image' ? "Image" : mode === 'voice' ? "Voice" : "Text"}<ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onSelect={() => setMode('text')}><Type />Text</DropdownMenuItem><DropdownMenuItem onSelect={() => setMode('image')}><ImageIcon />Image</DropdownMenuItem><DropdownMenuItem onSelect={() => { setMode('voice'); setAi({ ...ai, prompt: ai.prompt || ai.text }); }}><AudioLines />Voice</DropdownMenuItem></DropdownMenuContent></DropdownMenu>{mode === 'image' ? <Option capability="text-to-image" names={RATIO_INPUTS} label="Aspect ratio" {...mediaSelection} disabled={ai.loading} /> : mode === 'voice' ? <Option capability="text-to-speech" names={VOICE_INPUTS} label="Voice" {...mediaSelection} disabled={ai.loading} /> : null}</div>} footerContent={<div className="flex min-w-0 items-center text-[11px] text-muted-foreground">{mode === 'image' ? <MediaModel key="image" kind="image" onSelectionChange={setMediaSelection} /> : mode === 'voice' ? <MediaModel key="voice" kind="voice" onSelectionChange={setMediaSelection} /> : <Model workspace />}</div>} trailingAction={<PromptInputActions className="justify-end gap-1.5"><PromptSubmit isLoading={ai.loading} onAction={submitAi} /></PromptInputActions>} />
				{ai.loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{mode === 'image' ? 'Generating image…' : mode === 'voice' ? 'Generating voice…' : 'Improving text…'}</p> : null}
				{ai.error ? <p role="alert" className="text-sm text-destructive">{ai.error}</p> : null}
				<div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => { requestId.current++; if (streamId.current) void window.models.text.cancelStream(streamId.current); setAi(null); editor.commands.focus(); }}>Close</Button></div>
			</div>, aiTarget) : null;
	if (inlineActive) return <>{toolbar}{inlineAi}</>;
	if ((!slash || !commands.length) && !selection && !linkOpen && (!ai || !ai.autoApply)) return <>{toolbar}{inlineAi}</>;
	return (<>{toolbar}{inlineAi}{createPortal(
		<div ref={setFloating} style={floatingStyles} className={`z-50 overflow-y-auto border bg-popover p-1 text-popover-foreground shadow-lg ${!slash && !linkOpen ? 'rounded-xl py-2' : 'rounded-md'}`}>
			{linkOpen ? <form className="flex w-80 items-center gap-1" onSubmit={(event) => {
				event.preventDefault();
				const chain = editor.chain().focus().extendMarkRange('link');
				if (href.trim()) chain.setLink({ href: href.trim() }).run(); else chain.unsetLink().run();
				onLinkOpenChange(false);
			}} onKeyDown={(event) => { if (event.key === 'Escape') { onLinkOpenChange(false); editor.commands.focus(); } }}>
				<Input autoFocus aria-label="Link URL" placeholder="https://" value={href} className="h-8 text-sm" onChange={(event) => setHref(event.target.value)} />
				<Button type="submit" size="sm">Apply</Button>
				{state.link ? <Button type="button" variant="ghost" size="sm" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); onLinkOpenChange(false); }}>Remove</Button> : null}
			</form> : slash ? <div className="flex w-64 flex-col">
				<div role="listbox" aria-label="Editor commands" className="max-h-72 min-h-0 overflow-auto">
				{commands.map((command, index) => <button key={command.label} type="button" role="option" aria-selected={index === selected} className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${index === selected ? 'bg-accent text-accent-foreground' : ''}`} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setSelected(index)} onClick={() => execute(index)}><command.icon className="size-4" />{command.label}</button>)}
				</div>
				<div className="mt-1 flex shrink-0 items-center justify-between gap-2 border-t px-2 pb-1 pt-2 text-[11px] text-muted-foreground"><span>↑↓ Navigate</span><span>↵ Select</span><span>Esc Close</span></div>
			</div> : <div role="toolbar" aria-label="Selection formatting" className="flex flex-col gap-1">
				<Button ref={setStyleReference} type="button" variant="ghost" size="sm" className="h-8 w-full justify-start gap-1.5 rounded-lg px-2 text-xs font-medium" aria-label="Text style" aria-expanded={stylesOpen} aria-haspopup="menu" onMouseDown={(event) => event.preventDefault()} onClick={() => setStylesOpen(!stylesOpen)}>
					<Type className="size-4 text-muted-foreground" />
					<span className="flex-1 truncate text-left">{[...groups[1], ...groups[3].slice(0, 3)].find((action) => action.active && (typeof action.active === 'string' ? editor.isActive(action.active) : editor.isActive(...action.active)))?.label ?? 'Default text'}</span>
					<ChevronDown className="size-3.5 text-muted-foreground" />
				</Button>
				{stylesOpen ? createPortal(<div ref={setStyleFloating} style={stylePosition} role="menu" aria-label="Text styles" className="z-50 w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
					<div className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">Turn into</div>
					<button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().clearNodes().setParagraph().run(); setStylesOpen(false); }}><span className="flex size-7 items-center justify-center rounded-md border bg-muted/40"><Type className="size-4" /></span><span className="flex-1">Default text</span>{editor.isActive('paragraph') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('taskList') && !editor.isActive('blockquote') ? <Check className="size-4 text-muted-foreground" /> : null}</button>
					{[...groups[1], ...groups[3].slice(0, 3)].map((action) => <button key={action.label} type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => { action.run(editor.chain().focus()).run(); setStylesOpen(false); }}><span className="flex size-7 items-center justify-center rounded-md border bg-muted/40"><action.icon className="size-4" /></span><span className="flex-1">{action.label}</span>{action.active && (typeof action.active === 'string' ? editor.isActive(action.active) : editor.isActive(...action.active)) ? <Check className="size-4 text-muted-foreground" /> : null}</button>)}
				</div>, document.body) : null}
				<div className="mx-1 h-px bg-border" />
				<div className="flex flex-wrap items-center justify-center gap-0.5">
					{groups[2].map((action, index) => <Tooltip key={action.label}><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={action.label} aria-pressed={action.active ? state.active[5 + index] : undefined} className={`rounded-lg ${state.active[5 + index] ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} onMouseDown={(event) => event.preventDefault()} onClick={() => action.run(editor.chain().focus()).run()}><action.icon /></Button>} /><TooltipContent>{action.label}{action.shortcut ? <span className="opacity-60">{action.shortcut}</span> : null}</TooltipContent></Tooltip>)}
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Link" aria-pressed={state.link} className={`rounded-lg ${state.link ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} onMouseDown={(event) => event.preventDefault()} onClick={() => onLinkOpenChange(true)}><Link /></Button>
				</div>
				<div className="mx-1 h-px bg-border" />
				<div className="flex flex-col">
					{groups[3].slice(0, 3).map((action, index) => <Button key={action.label} type="button" variant="ghost" size="sm" aria-pressed={state.active[11 + index]} className={`h-8 justify-start gap-2 rounded-lg px-2 ${state.active[11 + index] ? 'bg-accent text-accent-foreground' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => action.run(editor.chain().focus()).run()}><action.icon className="text-muted-foreground" />{action.label}</Button>)}
				</div>
				{ai?.autoApply && ai.error ? <p role="alert" className="max-w-64 px-2 text-sm text-destructive">{ai.error}</p> : null}
				<div className="mx-1 h-px bg-border" />
				<div className="flex flex-col">
					{['Improve writing', 'Fix spelling and grammar', 'Make shorter', 'Make longer', 'Edit with AI'].map((label) => <Button key={label} type="button" variant="ghost" size="sm" className="h-8 justify-start gap-2 px-2" onMouseDown={(event) => event.preventDefault()} disabled={ai?.loading} onClick={() => openAi(label === 'Edit with AI' ? '' : label)}>{ai?.loading && ai.prompt === label ? <Loader2 className="animate-spin text-muted-foreground" /> : <Sparkles className="text-muted-foreground" />}{label}</Button>)}
				</div>
			</div>}
		</div>, document.body)}</>
	);
}
