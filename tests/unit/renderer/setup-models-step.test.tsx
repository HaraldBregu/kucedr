import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { SetupModelsStep } from '../../../src/renderer/src/pages/start/components/SetupModelsStep';
import type { ModelServiceStateMap } from '../../../src/renderer/src/pages/start/setupTypes';

jest.mock('@pages/settings/components/model-configuration', () => ({
	ModelProviderConfiguration: ({
		idPrefix,
		grouped,
		showFieldLabel,
		triggerTitle,
		children,
	}: {
		idPrefix: string;
		grouped?: boolean;
		showFieldLabel?: boolean;
		triggerTitle: React.ReactNode;
		children?: React.ReactNode;
	}) => (
		<div
			data-testid={idPrefix}
			data-grouped={grouped ? 'true' : 'false'}
			data-show-field-label={String(showFieldLabel)}
		>
			{triggerTitle}
			{children}
		</div>
	),
}));

jest.mock('../../../src/renderer/src/pages/start/components/SetupSearch', () => ({
	SetupSearch: () => <div data-testid="setup-search">SetupSearch Engine</div>,
}));

jest.mock('../../../src/renderer/src/pages/settings/pages/assistant/conversation', () => ({
	__esModule: true,
	default: ({
		selectDefaultModel,
		showFieldLabel,
	}: {
		selectDefaultModel?: boolean;
		showFieldLabel?: boolean;
	}) => (
		<div
			data-default-model={String(selectDefaultModel)}
			data-show-field-label={String(showFieldLabel)}
			data-testid="setup-realtime"
		>
			Realtime conversation
		</div>
	),
}));

const EMPTY_SERVICE = { providerId: '', modelId: '', modelGroups: [] };
const SERVICE_STATES: ModelServiceStateMap = {
	assistant: EMPTY_SERVICE,
	health: EMPTY_SERVICE,
	tasks: EMPTY_SERVICE,
	voice: EMPTY_SERVICE,
	transcription: EMPTY_SERVICE,
	image: EMPTY_SERVICE,
	video: EMPTY_SERVICE,
	audio: EMPTY_SERVICE,
};

it('groups model services in one card', () => {
	const { container } = render(
		<SetupModelsStep
			serviceStates={SERVICE_STATES}
			loadingModels={false}
			savingConfig={false}
			onServiceChange={jest.fn()}
			onLocalModelChange={jest.fn()}
		/>
	);

	const assistantGroup = screen.getByRole('region', { name: 'Model providers' });
	expect(container.firstElementChild).not.toHaveClass('px-4', 'sm:px-6');
	expect(assistantGroup.parentElement).toHaveClass('mt-6');
	const serviceIds = ['assistant', 'voice', 'transcription', 'image', 'audio', 'video'];
	for (const id of serviceIds) {
		expect(within(assistantGroup).getByTestId(`setup-${id}`)).toHaveAttribute(
			'data-grouped',
			'true'
		);
		expect(within(assistantGroup).getByTestId(`setup-${id}`)).toHaveAttribute(
			'data-show-field-label',
			'false'
		);
	}
	expect(within(assistantGroup).getByTestId('setup-assistant')).toHaveTextContent('Model');
	expect(within(assistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-default-model',
		'false'
	);
	expect(within(assistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-show-field-label',
		'false'
	);
	expect(
		within(assistantGroup)
			.getAllByTestId(/^setup-/)
			.map((element) => element.dataset.testid)
	).toEqual([
		'setup-assistant',
		'setup-realtime',
		...serviceIds.slice(1).map((id) => `setup-${id}`),
		'setup-search',
	]);
	expect(screen.queryByTestId('setup-health')).not.toBeInTheDocument();
	expect(screen.queryByTestId('setup-tasks')).not.toBeInTheDocument();
});

it('uses the Assistant local-model controls for Ollama', async () => {
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([
				{
					id: 'custom',
					name: 'Ollama',
					apiKey: 'ollama',
					baseUrl: 'http://localhost:11434/api',
				},
			]),
			listCustomModels: jest.fn().mockResolvedValue(['llama3.2:3b']),
		},
	});
	const serviceStates = {
		...SERVICE_STATES,
		assistant: {
			providerId: 'custom',
			modelId: 'local',
			modelGroups: [
				{
					provider: { id: 'custom', name: 'Local model', baseUrl: '' },
					models: [{ id: 'local', name: 'Local model' }],
				},
			],
		},
	};

	render(
		<SetupModelsStep
			serviceStates={serviceStates}
			loadingModels={false}
			savingConfig={false}
			onServiceChange={jest.fn()}
			onLocalModelChange={jest.fn()}
		/>
	);

	expect(await screen.findByLabelText('Local provider')).toHaveTextContent(/ollama/i);
	expect(await screen.findByLabelText('Local model')).toBeInTheDocument();
	expect(window.provider.listCustomModels).toHaveBeenCalledWith({
		baseUrl: 'http://localhost:11434/api',
		apiKey: 'ollama',
	});
});
