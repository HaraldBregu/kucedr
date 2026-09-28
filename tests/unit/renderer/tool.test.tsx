import { render, screen } from '@testing-library/react';
import { Tool } from '../../../src/renderer/src/components/prompt-kit/tool';

it('uses the compact Gmail image only for Gmail tool calls', () => {
	const { rerender } = render(
		<Tool
			toolPart={{
				type: 'mcp__gmail__send_email',
				state: 'output-available',
				serviceKind: 'mcp',
				serviceId: 'gmail',
			}}
		/>
	);

	expect(screen.getByRole('img', { name: 'Gmail' })).toHaveClass('size-3.5');

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

	expect(screen.queryByRole('img', { name: 'Gmail' })).not.toBeInTheDocument();
});
