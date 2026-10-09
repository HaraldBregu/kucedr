import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelProviderSelect } from '../../../src/renderer/src/components/model-provider-select';

it.each([false, true])('reveals the current model when reopening (compact: %s)', async (compactPopover) => {
	const scrollIntoView = jest.fn();
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
	const user = userEvent.setup();
	function Picker(): React.JSX.Element {
		const [modelId, setModelId] = useState('a');
		return <ModelProviderSelect idPrefix="reopen" providerGroups={[{ id: 'openai', models: [{ id: 'a', name: 'Model A' }, { id: 'b', name: 'Model B' }] }]} providerId="openai" modelId={modelId} onChange={(_, id) => setModelId(id)} buttonDropdown compactPopover={compactPopover} labels={{ label: 'Change model' }} />;
	}
	render(<Picker />);
	await user.click(screen.getByRole('button', { name: 'Change model' }));
	if (!compactPopover) await user.type(screen.getByRole('textbox'), 'Model B');
	await user.click(screen.getByRole('menuitemradio', { name: /Model B/ }));
	await user.click(screen.getByRole('button', { name: 'Change model' }));
	const selected = screen.getByRole('menuitemradio', { name: /Model B/ });
	expect(selected).toHaveAttribute('aria-checked', 'true');
	expect(screen.getByRole('menuitemradio', { name: /Model A/ })).toBeInTheDocument();
	await waitFor(() => expect(scrollIntoView.mock.contexts).toContain(selected));
	if (compactPopover) expect(selected).toHaveFocus();
	else expect(screen.getByRole('textbox')).toHaveFocus();
});

it('keeps an accessible selector name without rendering its field copy', () => {
	render(
		<ModelProviderSelect
			idPrefix="setup-model"
			providerGroups={[]}
			providerId=""
			modelId=""
			onChange={jest.fn()}
			showFieldLabel={false}
			labels={{ label: 'Model', description: 'Chat, reasoning, and planning.' }}
		/>
	);

	expect(screen.getByRole('combobox', { name: 'Model' })).toBeInTheDocument();
	expect(screen.queryByText('Model')).not.toBeInTheDocument();
	expect(screen.queryByText('Chat, reasoning, and planning.')).not.toBeInTheDocument();
});

it('filters models from the compact selection menu', async () => {
	const user = userEvent.setup();
	render(
		<ModelProviderSelect
			idPrefix="assistant-model"
			providerGroups={[
				{
					id: 'openai',
					models: [
						{ id: 'gpt-5', name: 'GPT-5' },
						{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
					],
				},
			]}
			providerId=""
			modelId=""
			onChange={jest.fn()}
			buttonDropdown
			labels={{ label: 'Model' }}
		/>
	);

	await user.click(screen.getByRole('button', { name: 'Model' }));
	expect(await screen.findByText('GPT-5')).toBeInTheDocument();
	await user.type(screen.getByRole('textbox'), 'mini');
	expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
	expect(screen.queryByText('GPT-5')).not.toBeInTheDocument();
});

it('shows the compact model name without a High suffix and keeps the dropdown chevron', async () => {
	const user = userEvent.setup();
	render(
		<ModelProviderSelect
			idPrefix="home-model"
			providerGroups={[{ id: 'anthropic', models: [{ id: 'opus', name: 'Opus 5 High' }] }]}
			providerId="anthropic"
			modelId="opus"
			onChange={jest.fn()}
			buttonDropdown
			compactPopover
			labels={{ label: 'Change model' }}
		/>
	);

	const trigger = screen.getByRole('button', { name: 'Change model' });
	expect(trigger).toHaveTextContent('Opus 5');
	expect(trigger).not.toHaveTextContent('High');
	expect(trigger.querySelector('svg')).toBeInTheDocument();
	await user.click(trigger);
	expect(screen.getByRole('menuitemradio', { name: /Opus 5 High/ })).toBeInTheDocument();
});
