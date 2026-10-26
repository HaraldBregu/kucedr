import { useMemo } from 'react';
import {
	NodeViewContent,
	NodeViewWrapper,
	useEditorState,
	type NodeViewProps,
} from '@tiptap/react';
import { PluginToolFrame } from '@/components/plugin-tool/Frame';
import { usePluginTools } from '@/hooks/use-plugin-tools';
import { cn } from '@/lib/utils';

export function WorkspaceCodeBlock({ node, editor, getPos }: NodeViewProps): React.JSX.Element {
	const { byFence } = usePluginTools();
	const pluginTool = node.attrs.language ? byFence.get(node.attrs.language) : undefined;
	const text = node.textContent;
	const input = useMemo(() => {
		if (!pluginTool) return undefined;
		try {
			return JSON.parse(text) as unknown;
		} catch {
			return undefined;
		}
	}, [pluginTool, text]);
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
	if (!pluginTool) return <NodeViewWrapper>{code}</NodeViewWrapper>;
	return (
		<NodeViewWrapper className="my-5">
			<div contentEditable={false}>
				{input !== undefined ? (
					<PluginToolFrame tool={pluginTool} input={input} />
				) : (
					<p className="mb-1 text-xs text-destructive">Invalid {pluginTool.title} JSON</p>
				)}
			</div>
			{code}
		</NodeViewWrapper>
	);
}
