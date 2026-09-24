import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

it('shows files as a list and images as a collection without an empty text bubble', () => {
	const { container } = render(
		<UserMessage
			content=""
			attachments={[
				{ type: 'attachment', kind: 'document', name: 'brief.pdf', mimeType: 'application/pdf', bytes: 1234 },
				{ type: 'attachment', kind: 'image', name: 'workspace.png', mimeType: 'image/png', bytes: 2048 },
				{ type: 'attachment', kind: 'text', name: 'notes.txt', mimeType: 'text/plain', bytes: 24 },
				{ type: 'attachment', kind: 'image', name: 'diagram.webp', mimeType: 'image/webp', bytes: 4096 },
			]}
		/>
	);

	const files = screen.getByRole('list', { name: 'Attached files' });
	const images = screen.getByRole('group', { name: 'Attached images' });
	expect(within(files).getAllByRole('listitem')).toHaveLength(2);
	expect(within(files).getByText('brief.pdf')).toBeInTheDocument();
	expect(within(files).getByText('notes.txt')).toBeInTheDocument();
	expect(within(images).queryByText('workspace.png')).not.toBeInTheDocument();
	expect(within(images).queryByText('diagram.webp')).not.toBeInTheDocument();
	expect(within(images).getByRole('group', { name: 'workspace.png' })).toBeInTheDocument();
	expect(within(images).getByRole('group', { name: 'diagram.webp' })).toBeInTheDocument();
	expect(within(images).queryByText('PNG · 2 KB')).not.toBeInTheDocument();
	expect(within(images).queryByText('WEBP · 4 KB')).not.toBeInTheDocument();
	expect(images).toHaveClass('grid');
	expect(images).toHaveStyle({ width: '8rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' });
	expect(files).toHaveClass('flex-col');
	expect(container.querySelector('[data-slot="user-message-content"]')).toBeNull();
});

it.each([1, 3, 4, 5])('fits the image collection to %i images with at most four columns', (count) => {
	render(
		<UserMessage
			content=""
			attachments={Array.from({ length: count }, (_, index) => ({
				type: 'attachment' as const,
				kind: 'image' as const,
				name: `image-${index}.png`,
				mimeType: 'image/png',
				bytes: 12,
			}))}
		/>
	);
	const columns = Math.min(count, 4);
	expect(screen.getByRole('group', { name: 'Attached images' })).toHaveStyle({
		width: `${columns * 4}rem`,
		gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
	});
});

it('previews a newly submitted image in the collection', async () => {
	const createObjectURL = jest.fn().mockReturnValue('blob:preview');
	const revokeObjectURL = jest.fn();
	Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
	Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
	const file = new File(['image'], 'photo.png', { type: 'image/png' });
	const { unmount } = render(
		<UserMessage
			content="See this"
			attachments={[{ type: 'attachment', kind: 'image', name: 'photo.png', mimeType: 'image/png', bytes: 5, file }]}
		/>
	);

	expect(await within(screen.getByRole('group', { name: 'Attached images' })).findByRole('img', { name: 'photo.png' })).toHaveAttribute('src', 'blob:preview');
	unmount();
	expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
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
