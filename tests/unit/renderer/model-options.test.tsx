import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelOptions } from '../../../src/renderer/src/components/model-options';

describe('ModelOptions', () => {
	it('keeps advanced properties in the expanded panel when requested', () => {
		const { container } = render(
			<ModelOptions
				inputs={{ duration: { type: 'integer', minimum: 1, maximum: 30, default: 8 } }}
				values={{}}
				inlineAdvanced
				onChange={jest.fn()}
			/>
		);

		expect(screen.getByText('Advanced properties')).toBeInTheDocument();
		expect(screen.getByRole('spinbutton')).toHaveValue(8);
		expect(container.firstElementChild).not.toHaveClass('border-t');
		expect(container.querySelectorAll('.border-b-0').length).toBeGreaterThan(0);
	});

	it('renders nested provider choices as a select', async () => {
		const user = userEvent.setup();
		render(
			<ModelOptions
				inputs={{
					reasoning: {
						type: 'object',
						properties: {
							effort: { type: 'string', enum: ['low', 'medium', 'high'] },
						},
					},
				}}
				values={{}}
				onChange={jest.fn()}
			/>
		);

		expect(screen.getByText('reasoning effort')).toBeInTheDocument();
		expect(screen.getByRole('combobox')).toHaveTextContent('Provider default');
		expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
		await user.click(screen.getByRole('combobox'));
		expect(screen.getByRole('option', { name: 'high', hidden: true })).toBeInTheDocument();
	});

	it('uses provider choices for numeric enums', async () => {
		const user = userEvent.setup();
		render(
			<ModelOptions
				inputs={{ duration: { type: 'integer', enum: [5, 10] } }}
				values={{}}
				onChange={jest.fn()}
			/>
		);

		expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Advanced' }));
		await user.click(screen.getByRole('combobox'));
		expect(screen.getByRole('option', { name: '10', hidden: true })).toBeInTheDocument();
	});

	it('displays provider defaults without storing them as overrides', async () => {
		const user = userEvent.setup();
		render(
			<ModelOptions
				inputs={{
					aspect_ratio: { type: 'string', enum: ['16:9', '9:16'], default: '16:9' },
					duration: { type: 'integer', minimum: 1, maximum: 30, default: 8 },
					enhance_prompt: { type: 'boolean', default: true },
				}}
				values={{}}
				onChange={jest.fn()}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'Advanced' }));
		expect(screen.getByRole('combobox')).toHaveTextContent('Provider default (16:9)');
		expect(screen.getByRole('spinbutton')).toHaveValue(8);
		expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '1');
		expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '30');
		expect(screen.getByRole('switch')).toBeChecked();
	});

	it('replaces properties when the selected model inputs change', () => {
		const { rerender } = render(
			<ModelOptions
				inputs={{ reasoning_effort: { type: 'string', enum: ['low', 'high'] } }}
				values={{}}
				onChange={jest.fn()}
			/>
		);

		expect(screen.getByText('reasoning effort')).toBeInTheDocument();
		rerender(
			<ModelOptions
				inputs={{
					thinking: {
						type: 'object',
						properties: { type: { type: 'string', enum: ['enabled', 'disabled'] } },
					},
					temperature: { type: 'number' },
				}}
				values={{}}
				onChange={jest.fn()}
			/>
		);

		expect(screen.queryByText('reasoning effort')).not.toBeInTheDocument();
		expect(screen.getByText('thinking type')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
		expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
	});

	it('does not render unsupported object-only schemas', () => {
		const { container } = render(
			<ModelOptions
				inputs={{ response_format: { type: 'object' } }}
				values={{}}
				onChange={jest.fn()}
			/>
		);

		expect(container).toBeEmptyDOMElement();
	});

	it('shows voice selection before advanced options', async () => {
		const user = userEvent.setup();
		render(
			<ModelOptions
				inputs={{
					voice: { type: 'string', enum: ['alloy', 'cedar'] },
					speed: { type: 'number', minimum: 0.25, maximum: 4 },
				}}
				values={{ voice: 'cedar' }}
				onChange={jest.fn()}
			/>
		);

		expect(screen.getByText('voice')).toBeInTheDocument();
		expect(screen.getByRole('combobox')).toHaveTextContent('cedar');
		expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Advanced' }));
		expect(screen.getByRole('spinbutton')).toBeInTheDocument();
	});

	it('edits provider collection options as JSON when enabled', async () => {
		const onChange = jest.fn();
		const user = userEvent.setup();
		render(
			<ModelOptions
				inputs={{ previous_request_ids: { type: 'array', items: { type: 'string' } } }}
				values={{}}
				allowComplex
				onChange={onChange}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'Advanced' }));
		const input = screen.getByRole('textbox', { name: 'previous request ids' });
		fireEvent.change(input, { target: { value: '["request-1"]' } });
		expect(onChange).toHaveBeenLastCalledWith(['previous_request_ids'], ['request-1']);
	});
});
