import { render, screen } from '@testing-library/react';
import { AudioPlayer } from '@/components/audio-player';

describe('AudioPlayer', () => {
	it('shows the audio controls without a visual media surface', () => {
		const { container } = render(<AudioPlayer src="local-resource://file/audio.mp3" />);

		expect(container.querySelector('[data-slot="audio-player"]')).toHaveClass('min-w-0', 'w-full');
		expect(container.querySelector('audio')).toHaveAttribute(
			'src',
			'local-resource://file/audio.mp3'
		);
		expect(container.querySelector('video')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
		expect(container.querySelector('[data-slot="audio-player-seek"]')).toBeInTheDocument();
		expect(container.querySelectorAll('[data-slot="audio-player-time"]')).toHaveLength(2);
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
