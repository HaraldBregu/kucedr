import { useMemo, useState } from 'react';
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
import { WorkspaceScriptForm } from './ScriptForm';

export function WorkspaceCodeBlock({ node, editor, getPos }: NodeViewProps): React.JSX.Element {
	const { byFence } = usePluginScripts();
	const [formOpen, setFormOpen] = useState(false);
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
	const editing = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const pos = getPos();
			const { from, to } = current.state.selection;
			return pos !== undefined && from >= pos && to <= pos + node.nodeSize;
		},
	});

	const code = (
		<pre className={cn(input !== undefined && !editing && 'hidden')}>
			<NodeViewContent<'code'>
				as="code"
				className={node.attrs.language ? `language-${node.attrs.language}` : undefined}
			/>
		</pre>
	);
	if (!script) return <NodeViewWrapper>{code}</NodeViewWrapper>;
	const update = (next: Record<string, unknown>): void => {
		const pos = getPos();
		if (pos === undefined) return;
		editor
			.chain()
			.command(({ tr }) => {
				tr.replaceWith(pos + 1, pos + node.nodeSize - 1, editor.schema.text(JSON.stringify({ script: pluginScriptRef(script.name, script.version, script.plugin, ref?.createdAt), input: next }, null, 2)));
				return true;
			})
			.run();
	};
	return (
		<NodeViewWrapper className="my-5">
			<div contentEditable={false} className="relative">
				{script.inputSchema && input !== null && typeof input === 'object' && !Array.isArray(input) ? (
					<>
						<Button type="button" variant="outline" size="icon-sm" aria-label={`${script.title} properties`} className="absolute right-2 top-2 z-10" onClick={() => setFormOpen(true)}>
							<Settings2 />
						</Button>
						{formOpen ? (
							<WorkspaceScriptForm script={script} value={input as Record<string, unknown>} submitLabel="Save" onClose={() => setFormOpen(false)} onSubmit={(next) => {
								setFormOpen(false);
								update(next);
							}} />
						) : null}
					</>
				) : null}
				{input !== undefined ? (
					<PluginScriptFrame script={script} input={input} />
				) : (
					<p className="mb-1 text-xs text-destructive">Invalid {script.title} JSON</p>
				)}
			</div>
			{code}
		</NodeViewWrapper>
	);
}
