import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const markdownHighlight = HighlightStyle.define([
	{ tag: tags.heading, fontWeight: '600' },
	{ tag: tags.strong, fontWeight: '700' },
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.strikethrough, textDecoration: 'line-through' },
	{ tag: [tags.link, tags.url], color: 'var(--primary)', textDecoration: 'underline' },
	{ tag: tags.monospace, color: 'var(--primary)' },
]);

const theme = EditorView.theme({
	'&': { height: '100%', backgroundColor: 'transparent', color: 'var(--foreground)' },
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', lineHeight: '1.8' },
	'.cm-content': { minHeight: '100%', padding: '0', caretColor: 'var(--primary)' },
	'.cm-cursor': { borderLeftColor: 'var(--primary)' },
	'.cm-gutters': { display: 'none' },
});

export function Editor({
	value,
	onChange,
	onSave,
}: {
	value: string;
	onChange: (value: string) => void;
	onSave: () => void;
}) {
	const mount = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const onChangeRef = useRef(onChange);
	const onSaveRef = useRef(onSave);
	const initialValue = useRef(value);
	useEffect(() => {
		onChangeRef.current = onChange;
		onSaveRef.current = onSave;
	}, [onChange, onSave]);
	useEffect(() => {
		if (!mount.current) return;
		const editor = new EditorView({
			parent: mount.current,
			state: EditorState.create({
				doc: initialValue.current,
				extensions: [
					history(),
					markdown(),
					syntaxHighlighting(markdownHighlight),
					EditorView.lineWrapping,
					placeholder('Start writing…'),
					EditorView.contentAttributes.of({ 'aria-label': 'Markdown content', spellcheck: 'true' }),
					keymap.of([
						{
							key: 'Mod-s',
							run: () => {
								onSaveRef.current();
								return true;
							},
						},
						...defaultKeymap,
						...historyKeymap,
					]),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) onChangeRef.current(update.state.doc.toString());
					}),
					theme,
				],
			}),
		});
		view.current = editor;
		return () => {
			view.current = null;
			editor.destroy();
		};
	}, []);
	useEffect(() => {
		const editor = view.current;
		if (editor && editor.state.doc.toString() !== value)
			editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
	}, [value]);
	return <div ref={mount} className="min-h-0 flex-1 text-[15px]" />;
}
