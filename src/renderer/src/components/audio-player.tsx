import type { MouseEventHandler, ReactElement } from 'react';
import {
	VideoPlayer as VideoPlayerRoot,
	VideoPlayerControlBar,
	VideoPlayerMuteButton,
	VideoPlayerPlayButton,
	VideoPlayerTimeDisplay,
	VideoPlayerTimeRange,
} from '@/components/kibo-ui/video-player';
import { cn } from '@/lib/utils';

export function AudioPlayer({
	src,
	className,
	onContextMenu,
}: {
	readonly src: string;
	readonly className?: string;
	readonly onContextMenu?: MouseEventHandler<HTMLElement>;
}): ReactElement {
	return (
		<VideoPlayerRoot
			audio
			className={cn('block min-w-0 w-full overflow-hidden rounded-xl border border-border', className)}
			onContextMenu={onContextMenu}
		>
			<audio src={src} preload="metadata" slot="media" />
			<VideoPlayerControlBar className="w-full">
				<VideoPlayerPlayButton />
				<VideoPlayerTimeRange />
				<VideoPlayerTimeDisplay />
				<VideoPlayerMuteButton />
			</VideoPlayerControlBar>
		</VideoPlayerRoot>
	);
}
