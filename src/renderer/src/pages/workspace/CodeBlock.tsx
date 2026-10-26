import { useMemo } from 'react';
import { NodeViewContent, NodeViewWrapper, useEditorState, type NodeViewProps } from '@tiptap/react';
import { Chart } from '@/components/chart/Chart';
import { parseChart } from '@/components/chart/parse';
import { cn } from '@/lib/utils';

export function WorkspaceCodeBlock({ node, editor, getPos }: NodeViewProps): React.JSX.Element {
	const isChart = node.attrs.language === 'chart';
	const text = node.textContent;
	const chart = useMemo(() => {
		if (!isChart) return undefined;
		try {
			return parseChart(JSON.parse(text));
		} catch {
			return undefined;
		}
	}, [isChart, text]);
	const editing = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const pos = getPos();
			const { from, to } = current.state.selection;
			return pos !== undefined && from >= pos && to <= pos + node.nodeSize;
		},
	});

	const code = (
		<pre className={cn(chart && !editing && 'hidden')}>
			<NodeViewContent<'code'> as="code" className={node.attrs.language ? `language-${node.attrs.language}` : undefined} />
		</pre>
	);
	if (!isChart) return <NodeViewWrapper>{code}</NodeViewWrapper>;
	return (
		<NodeViewWrapper className="my-5">
			<div contentEditable={false}>
				{chart ? <Chart chart={chart} /> : <p className="mb-1 text-xs text-destructive">Invalid chart data</p>}
			</div>
			{code}
		</NodeViewWrapper>
	);
}
