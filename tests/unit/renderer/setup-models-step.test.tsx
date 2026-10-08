import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupCompaction } from '../../../src/renderer/src/pages/start/components/SetupCompaction';
import { SetupChatStep } from '../../../src/renderer/src/pages/start/components/SetupChatStep';
import { SetupVoiceStep } from '../../../src/renderer/src/pages/start/components/SetupVoiceStep';
import type { ModelServiceStateMap } from '../../../src/renderer/src/pages/start/setupTypes';

jest.mock('@/components/model-provider-select', () => ({
	ModelProviderSelect: ({
		buttonClassName,
		idPrefix,
		onChange,
		disabled,
	}: {
		buttonClassName?: string;
		idPrefix: string;
		onChange: (providerId: string, modelId: string) => void;
		disabled?: boolean;
	}) => (
		<button
			className={buttonClassName}
			data-testid={`${idPrefix}-select`}
			type="button"
			disabled={disabled}
			onClick={() => onChange('openai', 'test-model')}
		>
			Select model
		</button>
	),
	toModelProviderGroups: () => [],
}));

jest.mock('../../../src/renderer/src/pages/settings/pages/assistant/voice', () => ({
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

beforeEach(() => {
	window.agent = {
		getCompactModel: jest.fn().mockResolvedValue({ providerId: '', modelId: '', options: {} }),
		setCompactModel: jest.fn(async (value) => value),
	} as never;
});

it('shows only chat and tool configuration on Chat assistant', () => {
	render(
		<SetupChatStep
			serviceStates={SERVICE_STATES}
			loadingModels={false}
			savingConfig={false}
			onServiceChange={jest.fn()}
		/>
	);
	expect(screen.getByRole('heading', { name: 'Chat assistant' })).toBeInTheDocument();
	const chat = screen.getByRole('region', { name: 'Chat Assistant' });
	expect(within(chat).getByTestId('setup-assistant')).toHaveTextContent('LLM Model');
	expect(within(chat).getByTestId('setup-compaction')).toHaveTextContent(
		'Used to summarize older messages when you compact a conversation. When disabled, the Chat LLM is used.'
	);
	const tools = screen.getByRole('region', { name: 'Tools' });
	for (const id of ['image', 'video', 'audio']) {
		expect(within(tools).getByTestId(`setup-${id}-select`)).toBeInTheDocument();
	}
	expect(within(tools).queryByRole('combobox', { name: 'Search Engine' })).not.toBeInTheDocument();
	expect(screen.queryByRole('region', { name: 'Search providers' })).not.toBeInTheDocument();
	for (const id of ['voice', 'transcription', 'realtime', 'health', 'tasks']) {
		expect(screen.queryByTestId(`setup-${id}`)).not.toBeInTheDocument();
	}
});

it('shows speech, transcription, and live conversation on Voice assistant', () => {
	render(
		<SetupVoiceStep
			serviceStates={SERVICE_STATES}
			loadingModels={false}
			savingConfig={false}
			onServiceChange={jest.fn()}
		/>
	);
	expect(screen.getByRole('heading', { name: 'Voice assistant' })).toBeInTheDocument();
	const voice = screen.getByRole('region', { name: 'Voice Assistant' });
	for (const id of ['voice', 'transcription']) {
		expect(within(voice).getByTestId(`setup-${id}-select`)).toBeInTheDocument();
	}
	const realtime = within(voice).getByTestId('setup-realtime');
	expect(realtime).toHaveAttribute('data-default-model', 'false');
	expect(realtime).toHaveAttribute('data-show-selected-model', 'true');
	expect(realtime).toHaveAttribute('data-button-dropdown', 'true');
	for (const id of ['assistant', 'image', 'video', 'audio', 'search']) {
		expect(screen.queryByTestId(`setup-${id}`)).not.toBeInTheDocument();
	}
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
			providerId: 'ollama',
			modelId: 'local',
			modelGroups: [
				{
					provider: { id: 'ollama', name: 'Ollama', baseUrl: '' },
					models: [{ id: 'local', name: 'Local model' }],
				},
			],
		},
	};

	render(
		<SetupChatStep
			serviceStates={serviceStates}
			loadingModels={false}
			savingConfig={false}
			onServiceChange={jest.fn()}
		/>
	);

	await screen.findByTestId('setup-assistant-select');
	expect(window.provider.listCustomModels).toHaveBeenCalledWith({
		baseUrl: 'http://localhost:11434/api',
		apiKey: 'ollama',
	});
});

it('saves a compaction model and clears it when disabled', async () => {
	const user = userEvent.setup();
	render(<SetupCompaction modelGroups={[]} disabled={false} />);
	const selector = screen.getByTestId('setup-compaction-select');
	await waitFor(() => expect(selector).toBeEnabled());
	expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
	await user.click(selector);
	expect(window.agent.setCompactModel).toHaveBeenCalledWith({
		providerId: 'openai',
		modelId: 'test-model',
		options: {},
	});
	await user.click(await screen.findByRole('button', { name: 'Disable' }));
	expect(window.agent.setCompactModel).toHaveBeenLastCalledWith({
		providerId: '',
		modelId: '',
		options: {},
	});
	await waitFor(() =>
		expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
	);
});

it('restores an existing compaction model', async () => {
	window.agent.getCompactModel = jest
		.fn()
		.mockResolvedValue({ providerId: 'openai', modelId: 'test-model', options: {} });
	render(<SetupCompaction modelGroups={[]} disabled={false} />);
	expect(await screen.findByRole('button', { name: 'Disable' })).toBeEnabled();
	expect(window.agent.setCompactModel).not.toHaveBeenCalled();
});
