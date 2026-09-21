import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupModelsStep } from '../../../src/renderer/src/pages/start/components/SetupModelsStep';
import type { ModelServiceStateMap } from '../../../src/renderer/src/pages/start/setupTypes';

jest.mock('@/components/model-provider-select', () => ({
	ModelProviderSelect: ({
		buttonClassName,
		idPrefix,
	}: {
		buttonClassName?: string;
		idPrefix: string;
	}) => (
		<button className={buttonClassName} data-testid={`${idPrefix}-select`} type="button">
			Select model
		</button>
	),
	toModelProviderGroups: () => [],
}));

jest.mock('../../../src/renderer/src/pages/start/components/SetupSearch', () => ({
	SetupSearch: () => <div data-testid="setup-search">Search</div>,
}));

jest.mock('../../../src/renderer/src/pages/settings/pages/assistant/conversation', () => ({
	__esModule: true,
	default: ({
		buttonClassName,
		buttonDropdown,
		icon,
		selectDefaultModel,
		showSelectedModel,
		showFieldLabel,
	}: {
		buttonClassName?: string;
		buttonDropdown?: boolean;
		icon?: unknown;
		selectDefaultModel?: boolean;
		showSelectedModel?: boolean;
		showFieldLabel?: boolean;
	}) => (
		<div
			data-default-model={String(selectDefaultModel)}
			data-button-dropdown={String(buttonDropdown)}
			data-button-class-name={buttonClassName}
			data-has-icon={String(Boolean(icon))}
			data-show-selected-model={String(showSelectedModel)}
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

it('groups the chat and voice Assistant configurations', () => {
	const { container } = render(
		<SetupModelsStep
			serviceStates={SERVICE_STATES}
			loadingModels={false}
			savingConfig={false}
			onServiceChange={jest.fn()}
			onLocalModelChange={jest.fn()}
		/>
	);

	const chatAssistantGroup = screen.getByRole('region', { name: 'Chat Assistant' });
	const voiceAssistantGroup = screen.getByRole('region', { name: 'Voice Assistant' });
	const toolsGroup = screen.getByRole('region', { name: 'Tools' });
	expect(container.firstElementChild).not.toHaveClass('px-4', 'sm:px-6');
	expect(chatAssistantGroup.parentElement).toHaveClass('mt-6');
	const serviceIds = ['assistant', 'voice', 'transcription'];
	for (const id of serviceIds) {
		expect(within(chatAssistantGroup).getByTestId(`setup-${id}`)).toHaveAttribute(
			'data-slot',
			'item'
		);
		expect(within(chatAssistantGroup).getByTestId(`setup-${id}-select`)).toBeInTheDocument();
		expect(within(chatAssistantGroup).getByTestId(`setup-${id}-select`)).toHaveClass('w-40');
	}
	expect(within(chatAssistantGroup).getByTestId('setup-assistant')).toHaveTextContent('LLM Model');
	expect(within(voiceAssistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-default-model',
		'false'
	);
	expect(within(voiceAssistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-show-field-label',
		'false'
	);
	expect(within(voiceAssistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-has-icon',
		'true'
	);
	expect(within(voiceAssistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-show-selected-model',
		'true'
	);
	expect(within(voiceAssistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-button-dropdown',
		'true'
	);
	expect(within(voiceAssistantGroup).getByTestId('setup-realtime')).toHaveAttribute(
		'data-button-class-name',
		expect.stringContaining('w-40')
	);
	expect(within(toolsGroup).getByTestId('setup-search')).toBeInTheDocument();
	for (const id of ['image', 'video', 'audio']) {
		expect(within(toolsGroup).getByTestId(`setup-${id}`)).toHaveAttribute('data-slot', 'item');
		expect(within(toolsGroup).getByTestId(`setup-${id}-select`)).toBeInTheDocument();
		expect(within(toolsGroup).getByTestId(`setup-${id}-select`)).toHaveClass('w-40');
		expect(within(toolsGroup).getByTestId(`setup-${id}`).querySelector('svg')).toBeInTheDocument();
	}
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
			listCustomModels: jest.fn().mockResolvedValue(['llama3.2:3b', 'qwen3:8b']),
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

	const onLocalModelChange = jest.fn();
	render(
		<SetupModelsStep
			serviceStates={serviceStates}
			loadingModels={false}
			savingConfig={false}
			onServiceChange={jest.fn()}
			onLocalModelChange={onLocalModelChange}
		/>
	);

	await screen.findByTestId('setup-assistant-select');
	expect(window.provider.listCustomModels).toHaveBeenCalledWith({
		baseUrl: 'http://localhost:11434/api',
		apiKey: 'ollama',
	});
});
