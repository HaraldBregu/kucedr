import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelProviderSelect } from '../../../src/renderer/src/components/model-provider-select';

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
