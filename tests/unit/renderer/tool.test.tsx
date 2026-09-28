import { render } from '@testing-library/react';
import { Tool } from '../../../src/renderer/src/components/prompt-kit/tool';

it('uses the compact Gmail image only for Gmail tool calls', () => {
	const { container, rerender } = render(
		<Tool
			toolPart={{
				type: 'mcp__gmail__send_email',
				state: 'output-available',
				serviceKind: 'mcp',
				serviceId: 'gmail',
			}}
		/>
	);

	const gmailIcon = container.querySelector('img[aria-hidden="true"]');
	expect(gmailIcon).toHaveAttribute('src', 'file-mock');
	expect(gmailIcon).toHaveClass('size-3.5');

	rerender(
		<Tool
			toolPart={{
				type: 'mcp__notion__search',
				state: 'output-available',
				serviceKind: 'mcp',
				serviceId: 'notion',
			}}
		/>
	);

	expect(container.querySelector('img')).not.toBeInTheDocument();
});
