import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { AudioPlayer } from '@/components/audio-player';
import { workspaceResourceUrl } from './Resource';

export function WorkspaceAudio({ node, path }: NodeViewProps & { readonly path: string }): React.JSX.Element {
	return <NodeViewWrapper className="my-4">
		<AudioPlayer src={workspaceResourceUrl(path, node.attrs.src)} ariaLabel={node.attrs.alt} />
	</NodeViewWrapper>;
}
