import { render } from '@testing-library/react';
import { AudioPlayer } from '@/components/audio-player';

jest.mock('@/components/kibo-ui/video-player', () => {
	const React = jest.requireActual<typeof import('react')>('react');
	return {
		VideoPlayer: ({ audio, ...props }: { audio?: boolean }) =>
			React.createElement('media-controller', {
				...props,
				audio: audio ? '' : undefined,
			}),
		VideoPlayerControlBar: (props: object) =>
			React.createElement('media-control-bar', props),
		VideoPlayerMuteButton: (props: object) =>
			React.createElement('media-mute-button', props),
		VideoPlayerPlayButton: (props: object) =>
			React.createElement('media-play-button', props),
		VideoPlayerTimeDisplay: (props: object) =>
			React.createElement('media-time-display', props),
		VideoPlayerTimeRange: (props: object) =>
			React.createElement('media-time-range', props),
	};
});

describe('AudioPlayer', () => {
	it('uses the video player controls without a visual media surface', () => {
		const { container } = render(<AudioPlayer src="local-resource://file/audio.mp3" />);

		expect(container.querySelector('media-controller')).toHaveAttribute('audio');
		expect(container.querySelector('media-controller')).toHaveClass('block', 'min-w-0', 'w-full');
		expect(container.querySelector('media-control-bar')).toHaveClass('w-full');
		expect(container.querySelector('audio')).toHaveAttribute(
			'src',
			'local-resource://file/audio.mp3'
		);
		expect(container.querySelector('video')).not.toBeInTheDocument();
		expect(container.querySelector('media-play-button')).toBeInTheDocument();
		expect(container.querySelector('media-time-range')).toBeInTheDocument();
		expect(container.querySelector('media-time-display')).toBeInTheDocument();
		expect(container.querySelector('media-mute-button')).toBeInTheDocument();
		expect(container.querySelector('media-fullscreen-button')).not.toBeInTheDocument();
	});

	it('updates the native audio source', () => {
		const { container, rerender } = render(
			<AudioPlayer src="local-resource://file/first.mp3" />
		);

		rerender(<AudioPlayer src="local-resource://file/second.mp3" />);

		expect(container.querySelector('audio')).toHaveAttribute(
			'src',
			'local-resource://file/second.mp3'
		);
	});
});
