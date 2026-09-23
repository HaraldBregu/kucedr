import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
	defaultKeymap,
	history,
	historyKeymap,
	isolateHistory,
	redo,
	undo,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import {
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	HighlightStyle,
	syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState, RangeSetBuilder, Transaction } from '@codemirror/state';
import {
	findNext,
	findPrevious,
	getSearchQuery,
	search,
	SearchQuery,
	setSearchQuery,
} from '@codemirror/search';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	keymap,
	lineNumbers,
	placeholder,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { oneDarkHighlightStyle, oneDarkTheme } from '@codemirror/theme-one-dark';
import { tags } from '@lezer/highlight';

import { showNativeContextMenu } from '@/lib/menu';
import { languageForPath } from '@/lib/language';
import { cn } from '@/lib/utils';

export interface CodeMirrorEditorHandle {
	focus: () => void;
	find: (query: string, direction: 'next' | 'previous') => void;
	clearSearch: () => void;
	prefixLines: (prefix: string) => void;
	redo: () => void;
	undo: () => void;
	wrapSelection: (prefix: string, suffix?: string) => void;
}

interface CodeMirrorEditorProps {
	canSave?: boolean;
	className?: string;
	code?: boolean;
	fontSize?: number;
	foldable?: boolean;
	isDark?: boolean;
	lineNumbersVisible?: boolean;
	onChange: (value: string) => void;
	onSave?: () => unknown;
	path?: string;
	readOnly?: boolean;
	value: string;
	wordWrap?: boolean;
}

const markdownHighlight = HighlightStyle.define([
	{ tag: tags.heading, fontWeight: '600' },
	{ tag: tags.strong, fontWeight: '700' },
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.strikethrough, textDecoration: 'line-through' },
	{ tag: [tags.link, tags.url], color: 'var(--primary)', textDecoration: 'underline' },
	{ tag: tags.monospace, color: 'var(--primary)' },
	{
		tag: [tags.processingInstruction, tags.meta],
		color: 'color-mix(in oklch, var(--muted-foreground) 60%, transparent)',
	},
]);

const searchHighlight = EditorView.theme({
	'.cm-searchMatch': {
		backgroundColor: 'color-mix(in oklch, var(--primary) 22%, transparent)',
		borderBottom: '1px solid color-mix(in oklch, var(--primary) 42%, transparent)',
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: 'color-mix(in oklch, var(--primary) 72%, transparent)',
		color: 'var(--primary-foreground)',
		outline: '1px solid color-mix(in oklch, var(--primary) 88%, var(--foreground))',
	},
});

const searchMatch = Decoration.mark({ class: 'cm-searchMatch' });
const selectedSearchMatch = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' });
const searchMatches = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.highlight(view);
		}

		update(update: ViewUpdate) {
			if (
				update.docChanged ||
				update.selectionSet ||
				update.viewportChanged ||
				!getSearchQuery(update.startState).eq(getSearchQuery(update.state))
			) {
				this.decorations = this.highlight(update.view);
			}
		}

		highlight(view: EditorView) {
			const query = getSearchQuery(view.state);
			if (!query.valid) return Decoration.none;

			const matches = new RangeSetBuilder<Decoration>();
			for (const { from, to } of view.visibleRanges) {
				const cursor = query.getCursor(view.state, from, to);
				for (let result = cursor.next(); !result.done; result = cursor.next()) {
					const match = result.value;
					const selected = view.state.selection.ranges.some(
						(range) => range.from === match.from && range.to === match.to
					);
					matches.add(match.from, match.to, selected ? selectedSearchMatch : searchMatch);
				}
			}
			return matches.finish();
		}
	},
	{ decorations: (plugin) => plugin.decorations }
);

const noteEditorTheme = EditorView.theme({
	'&': {
		height: '100%',
		backgroundColor: 'transparent',
		color: 'var(--foreground)',
		fontSize: '15px',
	},
	'&.cm-focused': {
		outline: 'none',
	},
	'.cm-scroller': {
		overflow: 'auto',
		fontFamily: 'inherit',
		lineHeight: '1.85',
		userSelect: 'text',
	},
	'.cm-content': {
		minHeight: '360px',
		padding: '0',
		caretColor: 'var(--primary)',
		userSelect: 'text',
	},
	'.cm-line': {
		padding: '0',
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'var(--primary)',
	},
	'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
		backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent) !important',
	},
	'.cm-gutters': {
		display: 'none',
	},
	'.cm-activeLine': {
		backgroundColor: 'transparent',
	},
	'.cm-placeholder': {
		color: 'color-mix(in oklch, var(--muted-foreground) 55%, transparent)',
	},
});

const codeEditorTheme = EditorView.theme({
	'&': { height: '100%', backgroundColor: 'transparent', color: 'var(--foreground)' },
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
	'.cm-content': { minHeight: '100%', padding: '12px 0', caretColor: 'var(--primary)' },
	'.cm-line': { padding: '0 16px' },
	'.cm-gutters': {
		backgroundColor: 'color-mix(in oklch, var(--muted) 35%, transparent)',
		borderRight: '1px solid var(--border)',
		color: 'var(--muted-foreground)',
	},
	'.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 8px' },
	'.cm-activeLine, .cm-activeLineGutter': {
		backgroundColor: 'color-mix(in oklch, var(--muted) 45%, transparent)',
	},
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--primary)' },
	'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
		backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent) !important',
	},
});

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
	function CodeMirrorEditor(
		{
			canSave = true,
			className,
			code = false,
			fontSize = 13,
			foldable = false,
			isDark = false,
			lineNumbersVisible = true,
			onChange,
			onSave,
			path = '',
			readOnly = false,
			value,
			wordWrap = false,
		},
		ref
	) {
		const mountRef = useRef<HTMLDivElement>(null);
		const viewRef = useRef<EditorView>(null);
		const onChangeRef = useRef(onChange);
		const onSaveRef = useRef(onSave);
		const initialValueRef = useRef(value);
		const initialReadOnlyRef = useRef(readOnly);
		const initialIsDarkRef = useRef(isDark);
		const editabilityRef = useRef(new Compartment());
		const languageRef = useRef(new Compartment());
		const themeRef = useRef(new Compartment());
		const layoutRef = useRef(new Compartment());
		onChangeRef.current = onChange;
		onSaveRef.current = onSave;

		useImperativeHandle(
			ref,
			() => ({
				find(query, direction) {
					const view = viewRef.current;
					if (!view || !query) return;
					view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query })) });
					if (direction === 'next') findNext(view);
					else findPrevious(view);
					view.dispatch({
						effects: EditorView.scrollIntoView(view.state.selection.main.from, { y: 'center' }),
					});
				},
				clearSearch() {
					viewRef.current?.dispatch({
						effects: setSearchQuery.of(new SearchQuery({ search: '' })),
					});
				},
				wrapSelection(prefix, suffix = prefix) {
					const view = viewRef.current;
					if (!view) return;

					const { from, to } = view.state.selection.main;
					const selectedText = view.state.sliceDoc(from, to);
					view.dispatch({
						changes: { from, to, insert: `${prefix}${selectedText}${suffix}` },
						selection: { anchor: from + prefix.length, head: to + prefix.length },
						annotations: isolateHistory.of('full'),
						scrollIntoView: true,
					});
					view.focus();
				},
				prefixLines(prefix) {
					const view = viewRef.current;
					if (!view) return;

					const { from, to } = view.state.selection.main;
					const document = view.state.doc;
					const startLine = document.lineAt(from).number;
					const endLine = document.lineAt(to).number;
					const changes = [];

					for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
						changes.push({ from: document.line(lineNumber).from, insert: prefix });
					}

					view.dispatch({ changes, annotations: isolateHistory.of('full'), scrollIntoView: true });
					view.focus();
				},
				undo() {
					const view = viewRef.current;
					if (!view) return;
					undo(view);
					view.focus();
				},
				redo() {
					const view = viewRef.current;
					if (!view) return;
					redo(view);
					view.focus();
				},
				focus() {
					viewRef.current?.focus();
				},
			}),
			[]
		);

		useEffect(() => {
			if (!mountRef.current) return undefined;

			const view = new EditorView({
				doc: initialValueRef.current,
				extensions: [
					history(),
					keymap.of([
						{
							key: 'Mod-s',
							run: () => {
								if (!onSaveRef.current) return false;
								void onSaveRef.current();
								return true;
							},
						},
						...defaultKeymap,
						...historyKeymap,
						...foldKeymap,
					]),
					search(),
					languageRef.current.of(code ? [] : markdown()),
					themeRef.current.of(
						code
							? initialIsDarkRef.current
								? [oneDarkTheme, syntaxHighlighting(oneDarkHighlightStyle)]
								: syntaxHighlighting(defaultHighlightStyle, { fallback: true })
							: syntaxHighlighting(markdownHighlight, { fallback: true })
					),
					...(code
						? [
								layoutRef.current.of([
									...(lineNumbersVisible ? [lineNumbers()] : []),
									...(foldable ? [foldGutter()] : []),
									...(wordWrap ? [EditorView.lineWrapping] : []),
									EditorView.theme({ '&': { fontSize: `${fontSize}px` } }),
								]),
								codeEditorTheme,
								searchHighlight,
								searchMatches,
							]
						: [EditorView.lineWrapping, noteEditorTheme, searchHighlight, searchMatches]),
					placeholder(code ? '' : 'Start writing...'),
					editabilityRef.current.of([
						EditorState.readOnly.of(initialReadOnlyRef.current),
						EditorView.editable.of(!initialReadOnlyRef.current),
					]),
					EditorView.contentAttributes.of({
						'aria-label': code ? 'Code editor' : 'Note content',
						'aria-multiline': 'true',
						autocapitalize: code ? 'off' : 'sentences',
						spellcheck: code ? 'false' : 'true',
					}),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) onChangeRef.current(update.state.doc.toString());
					}),
				],
				parent: mountRef.current,
			});

			viewRef.current = view;

			return () => {
				view.destroy();
				viewRef.current = null;
			};
		}, []);

		useEffect(() => {
			if (!code || !path) return undefined;
			let active = true;
			void languageForPath(path).then((language) => {
				const view = viewRef.current;
				if (!active || !view) return;
				view.dispatch({ effects: languageRef.current.reconfigure(language ?? []) });
			});
			return () => {
				active = false;
			};
		}, [code, path]);

		useEffect(() => {
			const view = viewRef.current;
			if (!code || !view) return;
			view.dispatch({
				effects: themeRef.current.reconfigure(
					isDark
						? [oneDarkTheme, syntaxHighlighting(oneDarkHighlightStyle)]
						: syntaxHighlighting(defaultHighlightStyle, { fallback: true })
				),
			});
		}, [code, isDark]);

		useEffect(() => {
			const view = viewRef.current;
			if (!code || !view) return;
			view.dispatch({
				effects: layoutRef.current.reconfigure([
					...(lineNumbersVisible ? [lineNumbers()] : []),
					...(foldable ? [foldGutter()] : []),
					...(wordWrap ? [EditorView.lineWrapping] : []),
					EditorView.theme({ '&': { fontSize: `${fontSize}px` } }),
				]),
			});
		}, [code, foldable, fontSize, lineNumbersVisible, wordWrap]);

		useEffect(() => {
			const view = viewRef.current;
			if (!view || view.state.doc.toString() === value) return;
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: value },
				annotations: Transaction.addToHistory.of(false),
			});
		}, [value]);

		useEffect(() => {
			const view = viewRef.current;
			if (!view) return;
			view.dispatch({
				effects: editabilityRef.current.reconfigure([
					EditorState.readOnly.of(readOnly),
					EditorView.editable.of(!readOnly),
				]),
			});
		}, [readOnly]);

		return (
			<div
				ref={mountRef}
				className={cn('min-h-[360px]', className)}
				onContextMenu={(event) => {
					viewRef.current?.focus();
					showNativeContextMenu(
						event,
						readOnly
							? [
									{ type: 'role', role: 'copy' },
									{ type: 'role', role: 'selectAll' },
								]
							: [
									{ type: 'role', role: 'undo' },
									{ type: 'role', role: 'redo' },
									{ type: 'separator' },
									{ type: 'role', role: 'cut' },
									{ type: 'role', role: 'copy' },
									{ type: 'role', role: 'paste' },
									{ type: 'role', role: 'pasteAndMatchStyle' },
									{ type: 'role', role: 'delete' },
									{ type: 'separator' },
									{ type: 'role', role: 'selectAll' },
									{ type: 'separator' },
									{
										id: 'save',
										label: 'Save',
										accelerator: 'CommandOrControl+S',
										enabled: canSave,
									},
								],
						{ save: () => void onSaveRef.current?.() }
					);
				}}
			/>
		);
	}
);
