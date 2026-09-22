import type { AgentCard } from '@a2a-js/sdk';

const mockCreateFromAgentCard = jest.fn();
const mockClientFactory = jest.fn();
const mockJsonRpcTransportFactory = jest.fn();
const mockRestTransportFactory = jest.fn();

jest.mock('@a2a-js/sdk/client', () => ({
	ClientFactory: mockClientFactory,
	JsonRpcTransportFactory: mockJsonRpcTransportFactory,
	RestTransportFactory: mockRestTransportFactory,
}));

import { resolveA2aAuthentication } from '../../../../src/main/agent/a2a/authentication';
import { createA2aClient } from '../../../../src/main/agent/a2a/client';

const card: AgentCard = {
	name: 'Remote',
	description: 'Remote agent',
	supportedInterfaces: [
		{ url: 'https://agent.example/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0', tenant: '' },
	],
	provider: undefined,
	version: '1.0.0',
	capabilities: { extensions: [] },
	securitySchemes: {
		apiKey: {
			scheme: {
				$case: 'apiKeySecurityScheme',
				value: { description: '', location: 'header', name: 'X-API-Key' },
			},
		},
	},
	securityRequirements: [{ schemes: { apiKey: { list: [] } } }],
	defaultInputModes: ['text/plain'],
	defaultOutputModes: ['text/plain'],
	skills: [],
	signatures: [],
};

beforeEach(() => {
	mockClientFactory.mockImplementation(() => ({ createFromAgentCard: mockCreateFromAgentCard }));
	mockJsonRpcTransportFactory.mockImplementation(() => ({}));
	mockRestTransportFactory.mockImplementation(() => ({}));
	mockCreateFromAgentCard.mockResolvedValue({});
});

it('accepts a configured API key header declared by the Agent Card', async () => {
	await expect(
		createA2aClient(
			card,
			{ authType: 'api-key', credential: 'secret', apiKeyHeader: 'x-api-key' },
			'https://agent.example'
		)
	).resolves.toBeDefined();
});

it('rejects credentials that do not satisfy the Agent Card security requirement', async () => {
	await expect(
		createA2aClient(
			card,
			{ authType: 'bearer', credential: 'secret' },
			'https://agent.example'
		)
	).rejects.toThrow('authentication requirements');
});

it('pins authenticated interfaces to the configured HTTPS origin', async () => {
	await expect(
		createA2aClient(
			{
				...card,
				supportedInterfaces: [
					{ ...card.supportedInterfaces[0], url: 'https://other.example/a2a' },
				],
			},
			{ authType: 'api-key', credential: 'secret', apiKeyHeader: 'X-API-Key' },
			'https://agent.example'
		)
	).rejects.toThrow('match the configured agent origin');
});

it('ignores unsupported and legacy interfaces when a supported v1.0 interface exists', async () => {
	await expect(
		createA2aClient(
			{
				...card,
				supportedInterfaces: [
					{ url: 'grpc.example:443', protocolBinding: 'GRPC', protocolVersion: '1.0', tenant: '' },
					{ ...card.supportedInterfaces[0], protocolVersion: '0.3' },
					{ ...card.supportedInterfaces[0], protocolBinding: 'HTTP+JSON' },
				],
			},
			{ authType: 'api-key', credential: 'secret', apiKeyHeader: 'X-API-Key' },
			'https://agent.example'
		)
	).resolves.toBeDefined();
	expect(mockCreateFromAgentCard).toHaveBeenCalledWith(
		expect.objectContaining({
			supportedInterfaces: [expect.objectContaining({ protocolBinding: 'HTTP+JSON' })],
		})
	);
});

it('migrates an empty legacy token to no authentication when the endpoint changes', () => {
	const existing = {
		id: 'saved',
		name: 'Saved',
		url: 'https://old.example',
		authType: 'bearer' as const,
		credential: 'secret',
		enabled: true,
		skills: [],
	};
	expect(
		resolveA2aAuthentication(
			{ id: 'saved', name: 'Saved', url: 'https://new.example', token: '' },
			existing,
			'https://new.example'
		)
	).toEqual({ authType: 'none' });
});

it('rejects credentials on cleartext endpoints', () => {
	expect(() =>
		resolveA2aAuthentication(
			{
				name: 'Agent',
				url: 'http://agent.example',
				authType: 'bearer',
				credential: 'secret',
			},
			undefined,
			'http://agent.example'
		)
	).toThrow('must use HTTPS');
});
