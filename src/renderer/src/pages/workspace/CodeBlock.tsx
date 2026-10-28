import { useMemo } from 'react';
import {
	NodeViewContent,
	NodeViewWrapper,
	useEditorState,
	type NodeViewProps,
} from '@tiptap/react';
import { PluginScriptFrame } from '@/components/plugin-script/Frame';
import { usePluginScripts } from '@/hooks/use-plugin-scripts';
import { cn } from '@/lib/utils';

export function WorkspaceCodeBlock({ node, editor, getPos }: NodeViewProps): React.JSX.Element {
	const { byFence } = usePluginScripts();
	const script = node.attrs.language ? byFence.get(node.attrs.language) : undefined;
	const text = node.textContent;
	const input = useMemo(() => {
		if (!script) return undefined;
		try {
			return JSON.parse(text) as unknown;
		} catch {
			return undefined;
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
				tr.replaceWith(pos + 1, pos + node.nodeSize - 1, editor.schema.text(JSON.stringify(next, null, 2)));
				return true;
			})
			.run();
	};
	return (
		<NodeViewWrapper className="my-5">
			<div contentEditable={false} className="relative">
				{script.inputSchema && input !== null && typeof input === 'object' && !Array.isArray(input) ? (
					<Popover>
						<PopoverTrigger asChild>
							<Button type="button" variant="outline" size="icon-sm" aria-label={`${script.title} properties`} className="absolute right-2 top-2 z-10">
								<Settings2 />
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" className="max-h-[60vh] w-96 overflow-y-auto p-3">
							<ScriptProperties schema={script.inputSchema} value={input as Record<string, unknown>} onChange={update} />
						</PopoverContent>
					</Popover>
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
