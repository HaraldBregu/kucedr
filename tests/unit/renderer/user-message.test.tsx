import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserMessage } from '../../../src/renderer/src/pages/home/components/UserMessage';

jest.mock('@/components/prompt-kit/markdown', () => ({
	Markdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

it('does not render a user bubble before a voice transcript is available', () => {
	const { container, rerender } = render(<UserMessage content="" />);
	expect(container).toBeEmptyDOMElement();

	rerender(<UserMessage content="Show the message I sent." />);
	expect(screen.getByText('Show the message I sent.')).toBeInTheDocument();
});

it('shows submitted file cards even when the message has no text', () => {
	const { container } = render(
		<UserMessage
			content=""
			attachments={[
				{ type: 'attachment', kind: 'document', name: 'brief.pdf', mimeType: 'application/pdf', bytes: 1234 },
				{ type: 'attachment', kind: 'image', name: 'workspace.png', mimeType: 'image/png', bytes: 2048 },
			]}
		/>
	);

	expect(screen.getByText('brief.pdf')).toBeInTheDocument();
	expect(screen.getByText('PDF · 1 KB')).toBeInTheDocument();
	expect(screen.getByText('workspace.png')).toBeInTheDocument();
	expect(screen.getByText('PNG · 2 KB')).toBeInTheDocument();
	expect(container.querySelectorAll('[data-slot="attachment"]')).toHaveLength(2);
	expect(container.querySelector('[data-slot="user-message-content"]')).toBeNull();
});

it('copies a user message', async () => {
	const writeText = jest.fn().mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText },
	});
	render(<UserMessage content="Copy this message." />);

	fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));

	await waitFor(() => expect(writeText).toHaveBeenCalledWith('Copy this message.'));
});

it('shows long user messages in full without an expand control', () => {
	const content = 'Long message '.repeat(60);
	const { container } = render(<UserMessage content={content} onEdit={jest.fn()} />);
	expect(container.querySelector('[data-slot="user-message-content"]')?.textContent?.trim()).toBe(
		content.trim()
	);
	expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Less' })).not.toBeInTheDocument();
});

it('edits a user message inline', async () => {
	const onEdit = jest.fn().mockResolvedValue(true);
	render(<UserMessage content="Original message" onEdit={onEdit} />);

	fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
	const editor = screen.getByRole('textbox', { name: 'Edit message text' });
	fireEvent.change(editor, { target: { value: 'Updated message' } });
	fireEvent.click(screen.getByRole('button', { name: 'Submit edit' }));

	await waitFor(() => expect(onEdit).toHaveBeenCalledWith('Updated message'));
	await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit message' })).toBeNull());
});

it('cancels an inline edit without saving', () => {
	const onEdit = jest.fn().mockResolvedValue(true);
	render(<UserMessage content="Original message" onEdit={onEdit} />);

	fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
	fireEvent.change(screen.getByRole('textbox', { name: 'Edit message text' }), {
		target: { value: 'Discarded message' },
	});
	fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }));

	expect(onEdit).not.toHaveBeenCalled();
	expect(screen.getByText('Original message')).toBeInTheDocument();
});
