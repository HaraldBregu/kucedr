import { useEffect, useMemo, useState } from 'react';
import {
	NodeViewContent,
	NodeViewWrapper,
	useEditorState,
	type NodeViewProps,
} from '@tiptap/react';
import { Settings2 } from 'lucide-react';
import { PluginScriptFrame } from '@/components/plugin-script/Frame';
import { Button } from '@/components/ui/button';
import { usePluginScripts } from '@/hooks/use-plugin-scripts';
import { cn } from '@/lib/utils';
import { pluginScriptRef, type PluginScriptRef } from '../../../../shared/plugin_script_ref';
import { ScriptProperties } from './Properties';

export function WorkspaceCodeBlock({ node, editor, getPos }: NodeViewProps): React.JSX.Element {
	const { byFence } = usePluginScripts();
	// ponytail: a block stamped under 2s ago was just inserted, so its form opens; pass a flag through the insert command if this ever misfires
	const [formOpen, setFormOpen] = useState(() => {
		try {
			return editor.isEditable && Date.now() - Date.parse(JSON.parse(node.textContent).script.createdAt) < 2000;
		} catch {
			return false;
		}
	});
	const [draft, setDraft] = useState<Record<string, unknown>>();
	const script = node.attrs.language ? byFence.get(node.attrs.language) : undefined;
	const text = node.textContent;
	const { input, ref } = useMemo((): { input?: unknown; ref?: PluginScriptRef } => {
		if (!script) return {};
		try {
			const body = JSON.parse(text) as unknown;
			if (body && typeof body === 'object' && 'script' in body && 'input' in body)
				return { input: body.input, ref: body.script as PluginScriptRef };
			return { input: body };
		} catch {
			return {};
		}
	}, [script, text]);
	useEffect(() => {
		const pos = getPos();
		if (!script || input === undefined || ref?.createdAt || !editor.isEditable || pos === undefined) return;
		const stamped = ref ? { ...ref, createdAt: new Date().toISOString() } : pluginScriptRef(script.name, script.version, script.plugin);
		editor.view.dispatch(
			editor.state.tr
				.replaceWith(pos + 1, pos + node.nodeSize - 1, editor.schema.text(JSON.stringify({ script: stamped, input }, null, 2)))
				.setMeta('addToHistory', false)
		);
	}, [script, input, ref, editor, getPos, node.nodeSize]);
	const editing = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const pos = getPos();
			const { from, to } = current.state.selection;
			return pos !== undefined && from >= pos && to <= pos + node.nodeSize;
		},
	});

	useEffect(() => {
		if (!script || !draft) return;
		// ponytail: fixed 400ms debounce so each keystroke doesn't spawn a script render
		const timer = setTimeout(() => {
			const pos = getPos();
			if (pos === undefined) return;
			const current = editor.state.doc.nodeAt(pos);
			const next = JSON.stringify({ script: pluginScriptRef(script.name, script.version, script.plugin, ref?.createdAt), input: draft }, null, 2);
			if (!current || current.textContent === next) return;
			editor.view.dispatch(editor.state.tr.replaceWith(pos + 1, pos + current.nodeSize - 1, editor.schema.text(next)));
		}, 400);
		return () => clearTimeout(timer);
	}, [draft, script, editor, getPos, ref?.createdAt]);

	const code = (
		<pre className={cn(input !== undefined && !editing && 'hidden')}>
			<NodeViewContent<'code'>
				as="code"
				className={node.attrs.language ? `language-${node.attrs.language}` : undefined}
			/>
		</pre>
	);
	if (!script) return <NodeViewWrapper>{code}</NodeViewWrapper>;
	const editable = script.inputSchema && input !== null && typeof input === 'object' && !Array.isArray(input);
	return (
		<NodeViewWrapper className="my-5">
			<div contentEditable={false} className="relative">
				{editable && editor.isEditable ? (
					<Button type="button" variant="outline" size="sm" aria-label={`${script.title} properties`} aria-expanded={formOpen} className="absolute right-2 top-2 z-10" onClick={() => {
						setDraft(undefined);
						setFormOpen(!formOpen);
					}}>
						<Settings2 />{formOpen ? 'Done' : 'Edit'}
					</Button>
				) : null}
				{input !== undefined ? (
					<PluginScriptFrame script={script} input={input} />
				) : (
					<p className="mb-1 text-xs text-destructive">Invalid {script.title} JSON</p>
				)}
				{editable && formOpen && script.inputSchema ? (
					<div role="group" aria-label={`${script.title} properties`} className="mt-2 rounded-md border p-3 text-sm leading-normal">
						<ScriptProperties schema={script.inputSchema} value={draft ?? input} onChange={(next) => setDraft(next as Record<string, unknown>)} />
					</div>
				) : null}
			</div>
			{code}
		</NodeViewWrapper>
	);
}
