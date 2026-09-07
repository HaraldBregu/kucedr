import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PromptEditor } from '@/components/prompt-editor';

jest.mock('@/components/ui/bar-wave-animation', () => ({
	BarWaveAnimation: () => <div data-testid="voice-waveform" />,
}));

jest.mock('@/components/persona', () => ({
	Persona: ({ state }: { state: string }) => <div data-testid="persona" data-state={state} />,
}));

jest.mock('@/components/text-editor', () => {
	const React = jest.requireActual<typeof import('react')>('react');
	return {
		TextEditor: ({
			value,
			onEditorReady,
			onVisualLineChange,
			className,
		}: {
			value?: string;
			onEditorReady?: (editor: { view: { dom: HTMLDivElement } }) => void;
			onVisualLineChange?: (hasMultipleLines: boolean) => void;
			className?: string;
		}) =>
			React.createElement(
				'div',
				{ className },
				React.createElement(
					'div',
					{
						ref: (element: HTMLDivElement | null) => {
							if (!element) return;
							onEditorReady?.({ view: { dom: element } });
							onVisualLineChange?.(Boolean(value && value.length > 40));
						},
						role: 'textbox',
					},
					value
				)
			),
	};
});

describe('PromptEditor', () => {
	it('expands when text wraps to another visual line and collapses when cleared', async () => {
		const { container, rerender } = render(
			<PromptEditor
				value=""
				leadingAction={<button>Attach</button>}
				actions={<button>Send</button>}
			/>
		);
		const prompt = container.querySelector('[data-expanded]');
		const attachmentButton = screen.getByRole('button', { name: 'Attach' });
		const sendButton = screen.getByRole('button', { name: 'Send' });
		attachmentButton.focus();

		await waitFor(() => expect(prompt).toHaveAttribute('data-expanded', 'false'));
		expect(prompt?.firstElementChild?.firstElementChild).toHaveClass('min-h-12');
		expect(prompt).toHaveClass('rounded-full');
		await waitFor(() => expect(prompt).toHaveStyle({ borderRadius: '28px' }));

		rerender(
			<PromptEditor
				value={'A long prompt that needs more vertical space. '.repeat(3)}
				leadingAction={<button>Attach</button>}
				actions={<button>Send</button>}
			/>
		);
		await waitFor(() => expect(prompt).toHaveAttribute('data-expanded', 'true'));
		expect(screen.getByRole('button', { name: 'Attach' })).toBe(attachmentButton);
		expect(screen.getByRole('button', { name: 'Send' })).toBe(sendButton);
		expect(attachmentButton).toHaveFocus();
		expect(prompt?.firstElementChild?.firstElementChild).toHaveClass('min-h-24');
		expect(prompt).toHaveClass('rounded-xl');
		await waitFor(() => expect(prompt).toHaveStyle({ borderRadius: '12px' }));

		rerender(
			<PromptEditor
				value=""
				leadingAction={<button>Attach</button>}
				actions={<button>Send</button>}
			/>
		);
		await waitFor(() => expect(prompt).toHaveAttribute('data-expanded', 'false'));
		expect(prompt?.firstElementChild?.firstElementChild).toHaveClass('min-h-12');
		expect(prompt).toHaveClass('rounded-full');
		await waitFor(() => expect(prompt).toHaveStyle({ borderRadius: '28px' }));
		expect(screen.getByRole('button', { name: 'Attach' })).toBe(attachmentButton);
		expect(screen.getByRole('button', { name: 'Send' })).toBe(sendButton);
		expect(attachmentButton).toHaveFocus();
	});

	it('shows only the persona and a top-right stop control during voice conversation', () => {
		const onVoiceEnd = jest.fn();
		const { container } = render(
			<PromptEditor
				value=""
				leadingAction={<button>Attach</button>}
				actions={<button>Send</button>}
				voiceMode="conversation"
				voiceStatus="Kucedr is speaking…"
				voiceElapsedMs={10_000}
				voicePersonaState="speaking"
				voiceMuted={false}
				onVoiceEnd={onVoiceEnd}
			/>
		);

		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(screen.getByTestId('persona')).toHaveAttribute('data-state', 'speaking');
		expect(container.querySelector('[data-voice-mode="conversation"]')).toHaveClass(
			'rounded-[1.75rem]'
		);
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(screen.queryByText('0:10')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'End voice conversation' }));
		expect(onVoiceEnd).toHaveBeenCalled();
	});
});
