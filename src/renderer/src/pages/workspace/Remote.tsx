import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { RemoteImage } from '@/components/remote-image';
import { workspaceResourceUrl } from './Resource';

export function WorkspaceRemoteImage({ node, path }: NodeViewProps & { readonly path: string }): React.JSX.Element {
	return <NodeViewWrapper>
		<RemoteImage src={workspaceResourceUrl(path, node.attrs.src)} alt={node.attrs.alt} />
	</NodeViewWrapper>;
}
