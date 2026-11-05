import { useEffect, useState } from 'react';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react-dom';
import type { ChainedCommands, Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
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
	Globe,
	Library,
	Italic,
	Link,
	List,
	ListChecks,
	ListOrdered,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePluginScripts } from '@/hooks/use-plugin-scripts';
import type { PluginScriptInfo } from '../../../../shared/plugin_types';

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

export function WorkspaceToolbar({ editor, linkOpen, onLinkOpenChange, onInsertFromComputer, onInsertFromLibrary, onInsertFromUrl, onInsertScript, wide, onWideChange, onFind }: WorkspaceToolbarProps): React.JSX.Element {
	const [href, setHref] = useState('');
	const [selection, setSelection] = useState(false);
	const [stylesOpen, setStylesOpen] = useState(false);
	const [slash, setSlash] = useState<{ from: number; to: number; query: string } | null>(null);
	const [selected, setSelected] = useState(0);
	const [dismissed, setDismissed] = useState<number | null>(null);
	const { byFence } = usePluginScripts();
	const { refs: { setReference, setFloating }, elements: { floating: floatingElement }, floatingStyles, update: updatePosition } = useFloating({ placement: slash ? 'bottom-start' : 'top', middleware: [offset(8), flip(), shift({ padding: 8 })], whileElementsMounted: autoUpdate });
	const { refs: { setReference: setStyleReference, setFloating: setStyleFloating }, floatingStyles: stylePosition } = useFloating({ placement: 'bottom-start', middleware: [offset(8), flip(), shift({ padding: 8 })], whileElementsMounted: autoUpdate });
	const state = useEditorState({ editor, selector: ({ editor: current }) => ({
		active: groups.flat().map((action) => action.active ? typeof action.active === 'string' ? current.isActive(action.active) : current.isActive(...action.active) : false),
		table: current.isActive('table'), link: current.isActive('link'), canUndo: current.can().undo(), canRedo: current.can().redo(),
	}) });
	const commands = [
		...groups.flat().filter((action) => !((action.label === 'Undo' && !state.canUndo) || (action.label === 'Redo' && !state.canRedo))).map((action) => ({ label: action.label, icon: action.icon, run: () => action.run(editor.chain().focus()).run() })),
		...(state.table ? tableActions.map((action) => ({ label: action.label, icon: action.icon, run: () => action.run(editor.chain().focus()).run() })) : []),
		{ label: 'Link', icon: Link, run: () => onLinkOpenChange(true) },
		{ label: 'Insert from computer', icon: HardDrive, run: onInsertFromComputer },
		{ label: 'Insert from library', icon: Library, run: onInsertFromLibrary },
		{ label: 'Insert from URL', icon: Globe, run: onInsertFromUrl },
		...[...byFence].map(([, script]) => ({ label: script.title, icon: FileBox, run: () => onInsertScript(script) })),
		{ label: 'Find in file', icon: Search, run: onFind },
		{ label: 'Full width', icon: MoveHorizontal, run: () => onWideChange(!wide) },
	].filter((command) => command.label.toLowerCase().includes(slash?.query.toLowerCase() ?? ''));

	useEffect(() => {
		const update = (): void => {
			const { from, empty, $from } = editor.state.selection;
			const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
			const match = empty && editor.isFocused ? before.match(/\/([^/]*)$/) : null;
			const start = match ? from - match[0].length : null;
			setSlash(start !== null && start !== dismissed ? { from: start, to: from, query: match![1] } : null);
			setSelection(!empty && editor.isFocused);
			if (start === null || start !== dismissed) setDismissed(null);
		};
		editor.on('transaction', update);
		editor.on('focus', update);
		editor.on('blur', update);
		update();
		return () => { editor.off('transaction', update); editor.off('focus', update); editor.off('blur', update); };
	}, [editor, dismissed]);

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
				const pos = editor.view.coordsAtPos(slash?.to ?? editor.state.selection.from);
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

	if ((!slash || !commands.length) && !selection && !linkOpen) return <></>;
	return (
		<div ref={setFloating} style={floatingStyles} className={`z-50 border bg-popover p-1 text-popover-foreground shadow-lg ${!slash && !linkOpen ? 'rounded-xl py-2' : 'rounded-md'}`}>
			{linkOpen ? <form className="flex w-80 items-center gap-1" onSubmit={(event) => {
				event.preventDefault();
				const chain = editor.chain().focus().extendMarkRange('link');
				if (href.trim()) chain.setLink({ href: href.trim() }).run(); else chain.unsetLink().run();
				onLinkOpenChange(false);
			}} onKeyDown={(event) => { if (event.key === 'Escape') { onLinkOpenChange(false); editor.commands.focus(); } }}>
				<Input autoFocus aria-label="Link URL" placeholder="https://" value={href} className="h-8 text-sm" onChange={(event) => setHref(event.target.value)} />
				<Button type="submit" size="sm">Apply</Button>
				{state.link ? <Button type="button" variant="ghost" size="sm" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); onLinkOpenChange(false); }}>Remove</Button> : null}
			</form> : slash ? <div role="listbox" aria-label="Editor commands" className="max-h-72 w-64 overflow-auto">
				{commands.map((command, index) => <button key={command.label} type="button" role="option" aria-selected={index === selected} className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${index === selected ? 'bg-accent text-accent-foreground' : ''}`} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setSelected(index)} onClick={() => execute(index)}><command.icon className="size-4" />{command.label}</button>)}
			</div> : <div role="toolbar" aria-label="Selection formatting" className="flex flex-col gap-1">
				<Button ref={setStyleReference} type="button" variant="ghost" size="sm" className="h-8 w-full justify-start gap-1.5 rounded-lg px-2 text-xs font-medium" aria-label="Text style" aria-expanded={stylesOpen} aria-haspopup="menu" onMouseDown={(event) => event.preventDefault()} onClick={() => setStylesOpen(!stylesOpen)}>
					<Type className="size-4 text-muted-foreground" />
					<span className="flex-1 truncate text-left">{[...groups[1], ...groups[3].slice(0, 5)].find((action) => action.active && (typeof action.active === 'string' ? editor.isActive(action.active) : editor.isActive(...action.active)))?.label ?? 'Default text'}</span>
					<ChevronDown className="size-3.5 text-muted-foreground" />
				</Button>
				{stylesOpen ? <div ref={setStyleFloating} style={stylePosition} role="menu" aria-label="Text styles" className="z-50 w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
					<div className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">Turn into</div>
					<button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().clearNodes().setParagraph().run(); setStylesOpen(false); }}><span className="flex size-7 items-center justify-center rounded-md border bg-muted/40"><Type className="size-4" /></span><span className="flex-1">Default text</span>{editor.isActive('paragraph') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('taskList') && !editor.isActive('blockquote') ? <Check className="size-4 text-muted-foreground" /> : null}</button>
					{[...groups[1], ...groups[3].slice(0, 5)].map((action) => <button key={action.label} type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => { action.run(editor.chain().focus()).run(); setStylesOpen(false); }}><span className="flex size-7 items-center justify-center rounded-md border bg-muted/40"><action.icon className="size-4" /></span><span className="flex-1">{action.label}</span>{action.active && (typeof action.active === 'string' ? editor.isActive(action.active) : editor.isActive(...action.active)) ? <Check className="size-4 text-muted-foreground" /> : null}</button>)}
				</div> : null}
				<div className="mx-1 h-px bg-border" />
				<div className="flex items-center gap-0.5">
					{groups[2].map((action, index) => <Tooltip key={action.label}><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={action.label} aria-pressed={action.active ? state.active[5 + index] : undefined} className={`rounded-lg ${state.active[5 + index] ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} onMouseDown={(event) => event.preventDefault()} onClick={() => action.run(editor.chain().focus()).run()}><action.icon /></Button>} /><TooltipContent>{action.label}{action.shortcut ? <span className="opacity-60">{action.shortcut}</span> : null}</TooltipContent></Tooltip>)}
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Link" aria-pressed={state.link} className={`rounded-lg ${state.link ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} onMouseDown={(event) => event.preventDefault()} onClick={() => onLinkOpenChange(true)}><Link /></Button>
				</div>
			</div>}
		</div>
	);
}
