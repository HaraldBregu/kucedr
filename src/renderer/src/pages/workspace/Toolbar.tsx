import { useState } from 'react';
import type { ChainedCommands, Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
	Bold,
	Code,
	Columns3,
	Eraser,
	FileCode,
	Heading1,
	Heading2,
	Heading3,
	ImagePlus,
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
	Underline,
	Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
		{ label: 'Table', icon: Table, run: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
	],
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
	readonly onInsertAsset: () => void;
}

export function WorkspaceToolbar({ editor, linkOpen, onLinkOpenChange, onInsertAsset }: WorkspaceToolbarProps): React.JSX.Element {
	const [href, setHref] = useState('');
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			active: groups.flat().map((action) => action.active ? typeof action.active === 'string' ? current.isActive(action.active) : current.isActive(...action.active) : false),
			table: current.isActive('table'),
			link: current.isActive('link'),
			canUndo: current.can().undo(),
			canRedo: current.can().redo(),
		}),
	});
	const button = (action: Action, active: boolean, disabled = false, destructive = false): React.JSX.Element => (
		<Tooltip key={action.label}>
			<TooltipTrigger render={
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={action.label}
					aria-pressed={action.active ? active : undefined}
					disabled={disabled}
					className={`${active ? 'bg-muted text-foreground' : 'text-muted-foreground'} ${destructive ? 'text-destructive' : ''}`}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => action.run(editor.chain().focus()).run()}
				>
					<action.icon />
				</Button>
			} />
			<TooltipContent side="bottom">{action.label}{action.shortcut ? <span className="opacity-60">{action.shortcut}</span> : null}</TooltipContent>
		</Tooltip>
	);
	let index = 0;
	return (
		<div role="toolbar" aria-label="Formatting" className="sticky top-0 z-10 -mx-2 mb-4 flex flex-wrap items-center gap-0.5 border-b bg-background/95 px-2 py-1 backdrop-blur">
			{groups.map((group, groupIndex) => (
				<div key={groupIndex} className="flex items-center gap-0.5 not-first:border-l not-first:pl-1 not-first:ml-1">
					{group.map((action) => {
						const active = state.active[index++];
						const disabled = (action.label === 'Undo' && !state.canUndo) || (action.label === 'Redo' && !state.canRedo);
						return button(action, active, disabled);
					})}
					{groupIndex === 2 ? (
						<Popover open={linkOpen} onOpenChange={(open) => {
							if (open) setHref(editor.getAttributes('link').href ?? '');
							onLinkOpenChange(open);
						}}>
							<Tooltip>
								<TooltipTrigger render={
									<PopoverTrigger asChild>
										<Button type="button" variant="ghost" size="icon-sm" aria-label="Link" aria-pressed={state.link} className={state.link ? 'bg-muted text-foreground' : 'text-muted-foreground'} onMouseDown={(event) => event.preventDefault()}>
											<Link />
										</Button>
									</PopoverTrigger>
								} />
								<TooltipContent side="bottom">Link<span className="opacity-60">{mod}K</span></TooltipContent>
							</Tooltip>
							<PopoverContent align="start" className="w-80 p-2" onOpenAutoFocus={() => setHref(editor.getAttributes('link').href ?? '')}>
								<form className="flex items-center gap-1" onSubmit={(event) => {
									event.preventDefault();
									const chain = editor.chain().focus().extendMarkRange('link');
									if (href.trim()) chain.setLink({ href: href.trim() }).run();
									else chain.unsetLink().run();
									onLinkOpenChange(false);
								}}>
									<Input autoFocus aria-label="Link URL" placeholder="https://" value={href} className="h-8 text-sm" onChange={(event) => setHref(event.target.value)} />
									<Button type="submit" size="sm">Apply</Button>
									{state.link ? <Button type="button" variant="ghost" size="sm" onClick={() => {
										editor.chain().focus().extendMarkRange('link').unsetLink().run();
										onLinkOpenChange(false);
									}}>Remove</Button> : null}
								</form>
							</PopoverContent>
						</Popover>
					) : null}
					{groupIndex === 3 ? button({ label: 'Image or file', icon: ImagePlus, shortcut: `${mod}⇧I`, run: (chain) => chain }, false) : null}
				</div>
			))}
			{state.table ? (
				<div className="flex items-center gap-0.5 border-l pl-1 ml-1">
					{tableActions.map((action) => button(action, false, false, action.label.startsWith('Delete')))}
				</div>
			) : null}
		</div>
	);
}
