import type { RagConfiguration } from '../../../../src/shared/rag_types';
const getProvider = jest.fn();
jest.mock('../../../../src/main/settings_store', () => ({ getProvider }));
import { authorizeRagDisclosure } from '../../../../src/main/agent/knowledge/rag/disclosure';
import { assertRagConsent } from '../../../../src/main/agent/knowledge/rag/consent';

let configuration: RagConfiguration;
beforeEach(() => {
	getProvider.mockImplementation((_id, kind) => ({
		apiKey: kind === 'databases' ? 'synthetic-mirror-account' : 'synthetic-embedding-account',
	}));
	configuration = {
		enabled: true,
		indexName: 'knowledge-base',
		databaseId: 'pinecone',
		databaseProviderId: 'pinecone',
		embeddingProviderId: 'openai',
		embeddingModelId: 'model',
		embeddingConsent: null,
		mirrorConsent: null,
		folders: [],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
	};
});

it('leaves missing and legacy consent unapproved during ordinary saves', () => {
	expect(authorizeRagDisclosure(configuration).embeddingConsent).toBeNull();
	configuration.embeddingConsent = { providerId: 'openai', modelId: 'model' };
	const saved = authorizeRagDisclosure(configuration);
	expect(saved.embeddingConsent).toEqual(configuration.embeddingConsent);
	expect(() => assertRagConsent(saved, 'openai', 'model', 'knowledge-base')).toThrow('Confirm');
});

it('retains valid recipient consent without requiring another owner decision', () => {
	configuration.embeddingConsent = { version: 1, providerId: 'openai', modelId: 'model' };
	configuration.mirrorConsent = { version: 1, indexName: 'knowledge-base' };
	const saved = authorizeRagDisclosure(configuration);
	expect(authorizeRagDisclosure({ ...saved, scheduleEnabled: true })).toMatchObject({
		embeddingConsent: saved.embeddingConsent,
		mirrorConsent: saved.mirrorConsent,
	});
	expect(() => assertRagConsent(saved, 'openai', 'model', 'knowledge-base', true)).not.toThrow();
	expect(JSON.stringify(saved)).not.toContain('synthetic-');
});

it('requires a selected database before authorizing remote storage', () => {
	configuration.databaseProviderId = '';
	configuration.databaseId = '';
	configuration.mirrorConsent = { version: 1, indexName: 'knowledge-base' };
	expect(() => authorizeRagDisclosure(configuration)).toThrow('Select a vector database');
});

it('requires the user database credential before authorizing remote storage', () => {
	getProvider.mockImplementation((_id, kind) =>
		kind === 'databases' ? undefined : { apiKey: 'synthetic-embedding-account' }
	);
	configuration.mirrorConsent = { version: 1, indexName: 'knowledge-base' };
	expect(() => authorizeRagDisclosure(configuration)).toThrow('Settings → Providers → Vector DB');
});

it('directs missing embedding credentials to model provider settings', () => {
	getProvider.mockReturnValue(undefined);
	configuration.embeddingConsent = { version: 1, providerId: 'openai', modelId: 'model' };
	expect(() => authorizeRagDisclosure(configuration)).toThrow(
		'Configure your OpenAI API key in Settings → Providers → Models.'
	);
});

it.each(['embedding', 'mirror'])(
	'does not remint existing consent after the %s account changes',
	(kind) => {
		configuration.embeddingConsent = { version: 1, providerId: 'openai', modelId: 'model' };
		configuration.mirrorConsent = { version: 1, indexName: 'knowledge-base' };
		const saved = authorizeRagDisclosure(configuration);
		getProvider.mockImplementation((_id, section) => ({
			apiKey:
				section === 'databases'
					? kind === 'mirror'
						? 'changed-account'
						: 'synthetic-mirror-account'
					: kind === 'embedding'
						? 'changed-account'
						: 'synthetic-embedding-account',
		}));
		const changed = authorizeRagDisclosure(saved);
		expect(changed).toEqual(saved);
		expect(() => assertRagConsent(changed, 'openai', 'model', 'knowledge-base', true)).toThrow(
			'Confirm'
		);
	}
);
