import { useEffect, useRef, type MouseEventHandler, type ReactElement } from 'react';
import { Pause, Play, Volume, Volume1, Volume2, VolumeX } from 'lucide-react';
import {
	AudioPlayer as AudioPlayerRoot,
	AudioPlayerPlay,
	AudioPlayerSeek,
	AudioPlayerTime,
	AudioPlayerVolume,
} from '@/components/ui/audio-player';
import { VolumeControlMute, VolumeControlSlider } from '@/components/ui/volume-control';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { cn } from '@/lib/utils';

const VOLUME_ICONS = { muted: VolumeX, low: Volume, medium: Volume1, high: Volume2 };

export function AudioPlayer({
	src,
	className,
	preload,
	ariaLabel,
	onContextMenu,
}: {
	readonly src: string;
	readonly className?: string;
	readonly preload?: 'none' | 'metadata' | 'auto';
	readonly ariaLabel?: string;
	readonly onContextMenu?: MouseEventHandler<HTMLElement>;
}): ReactElement {
	const player = useAudioPlayer({ src, preload });
	const media = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (player.element) media.current?.append(player.element);
	}, [player.element]);
	return (
		<AudioPlayerRoot
			player={player}
			aria-label={ariaLabel}
			className={cn('min-w-0 w-full flex-nowrap gap-2 rounded-xl border border-border p-1.5', className)}
			onContextMenu={onContextMenu}
		>
			<span ref={media} hidden />
			<AudioPlayerPlay className="size-8">
				{({ playing }) => (playing ? <Pause className="fill-current" /> : <Play className="fill-current" />)}
			</AudioPlayerPlay>
			<AudioPlayerTime />
			<AudioPlayerSeek className="min-w-12" />
			<AudioPlayerTime type="duration" />
			<AudioPlayerVolume className="w-auto shrink-0 gap-1">
				<VolumeControlMute
					render={(props, { level }) => {
						const Icon = VOLUME_ICONS[level as keyof typeof VOLUME_ICONS];
						return <button {...props}><Icon /></button>;
					}}
				/>
				<VolumeControlSlider className="w-16 max-sm:hidden" />
			</AudioPlayerVolume>
		</AudioPlayerRoot>
	);
}
