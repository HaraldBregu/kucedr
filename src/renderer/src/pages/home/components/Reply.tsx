import { Reply, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ReplyPreview({
	content,
	onCancel,
}: {
	readonly content: string;
	readonly onCancel: () => void;
}) {
	return (
		<div
			role="group"
			aria-label="Replying to Kucedr"
			className="flex min-w-0 items-start gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2"
		>
			<Reply className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
			<div className="min-w-0 flex-1">
				<p className="text-xs font-medium">Replying to Kucedr</p>
				<p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground [overflow-wrap:anywhere]">
					{content}
				</p>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label="Cancel reply"
				onClick={(event) => {
					event.stopPropagation();
					onCancel();
				}}
			>
				<X className="size-3.5" />
			</Button>
		</div>
	);
}
