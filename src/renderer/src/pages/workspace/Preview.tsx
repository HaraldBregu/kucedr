import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WorkspaceImagePreviewProps {
	readonly src: string;
	readonly alt: string;
	readonly onClose: () => void;
}

export function WorkspaceImagePreview({ src, alt, onClose }: WorkspaceImagePreviewProps): React.JSX.Element {
	return (
		<Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
			<DialogContent className="sm:max-w-5xl">
				<DialogHeader className="min-w-0 pr-10">
					<DialogTitle className="truncate">{alt || 'Image'}</DialogTitle>
				</DialogHeader>
				<div className="min-w-0 overflow-hidden rounded-md">
					<img src={src} alt={alt} draggable={false} className="h-[min(70vh,700px)] w-full rounded-md bg-muted/40 object-contain" />
				</div>
			</DialogContent>
		</Dialog>
	);
}
